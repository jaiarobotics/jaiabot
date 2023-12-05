// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/io/line_based/pty.h>
#include <goby/middleware/io/line_based/serial.h>
#include <goby/middleware/io/line_based/tcp_client.h>
#include <goby/middleware/io/line_based/tcp_server.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/util/linebasedcomms/gps_sentence.h>

#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/comms/comms.h"
#include "jaiabot/groups.h"
#include "jaiabot/health/health.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/hub.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/mission.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::MultiThreadApplication<jaiabot::config::HubManager>;

namespace jaiabot
{
namespace apps
{

constexpr goby::middleware::Group bot_gps_in{"bot_gps_in"};
constexpr goby::middleware::Group bot_gps_out{"bot_gps_out"};

class HubManager : public ApplicationBase
{
  public:
    HubManager();
    ~HubManager();

  private:
    void loop() override
    {
        latest_hub_status_.set_time_with_units(
            goby::time::SystemClock::now<goby::time::MicroTime>());

        if (last_health_report_time_ + std::chrono::seconds(cfg().health_report_timeout_seconds()) <
            goby::time::SteadyClock::now())
        {
            glog.is_warn() && glog << "Timeout on health report" << std::endl;
            latest_hub_status_.set_health_state(goby::middleware::protobuf::HEALTH__FAILED);
            latest_hub_status_.clear_error();
            latest_hub_status_.add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_HEALTH);
        }

        if (latest_hub_status_.IsInitialized())
        {
            glog.is_debug1() && glog << "Publishing hub status: "
                                     << latest_hub_status_.ShortDebugString() << std::endl;
            interprocess().publish<jaiabot::groups::hub_status>(latest_hub_status_);
        }
    }

    void handle_bot_nav(const jaiabot::protobuf::BotStatus& dccl_nav);
    void handle_command(const jaiabot::protobuf::Command& input_command);
    void handle_task_packet(const jaiabot::protobuf::TaskPacket& task_packet);
    void handle_command_for_hub(const jaiabot::protobuf::CommandForHub& input_command_for_hub);
    void
    handle_hardware_status(const jaiabot::protobuf::LinuxHardwareStatus& linux_hardware_status);

    void handle_subscription_report(
        const goby::middleware::intervehicle::protobuf::SubscriptionReport& report);

    void intervehicle_subscribe(int bot_modem_id);

  private:
    jaiabot::protobuf::HubStatus latest_hub_status_;
    goby::time::SteadyClock::time_point last_health_report_time_{std::chrono::seconds(0)};

    std::set<int> managed_bot_modem_ids_;

    // Map bot id to previouse task packet timestamp to ignore duplicates
    std::map<uint16_t, uint64_t> task_packet_id_to_prev_timestamp_;

    // map GPSD device name to contact ID
    struct Contact
    {
        int id;
        bool use_cog;
    };

    std::map<std::string, Contact> contact_gps_;
    // map GPSD device name to heading
    std::map<std::string, boost::units::quantity<boost::units::degree::plane_angle>>
        contact_heading_;

    // set of Bot IDs with bot_to_gps in use
    std::set<int> bot_to_gps_ids_;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::HubManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::HubManager>(argc, argv));
}

jaiabot::apps::HubManager::HubManager() : ApplicationBase(1 * si::hertz)
{
    latest_hub_status_.set_hub_id(cfg().hub_id());
    latest_hub_status_.set_fleet_id(cfg().fleet_id());

    for (auto peer : cfg().xbee().peers())
    {
        if (peer.has_bot_id())
        {
            managed_bot_modem_ids_.insert(jaiabot::comms::modem_id_from_bot_id(peer.bot_id()));
            latest_hub_status_.mutable_bot_ids_in_radio_file()->Add(peer.bot_id());
        }
    }

    for (auto contact_gps : cfg().contact_gps())
    {
        contact_gps_.insert(std::make_pair(
            contact_gps.gpsd_device(), Contact({contact_gps.contact(), contact_gps.use_cog()})));
    }

    for (auto bot_to_gps : cfg().bot_to_gps())
    {
        switch (bot_to_gps.transport_case())
        {
            case jaiabot::config::HubManager::BotToGPS::kUdp:
                launch_thread<goby::middleware::io::UDPPointToPointThread<bot_gps_in, bot_gps_out>>(
                    bot_to_gps.bot_id(), bot_to_gps.udp());
                break;
            case jaiabot::config::HubManager::BotToGPS::kPty:
                launch_thread<goby::middleware::io::PTYThreadLineBased<bot_gps_in, bot_gps_out>>(
                    bot_to_gps.bot_id(), bot_to_gps.pty());
                break;
            case jaiabot::config::HubManager::BotToGPS::kSerial:
                launch_thread<goby::middleware::io::SerialThreadLineBased<bot_gps_in, bot_gps_out>>(
                    bot_to_gps.bot_id(), bot_to_gps.serial());
                break;
            case jaiabot::config::HubManager::BotToGPS::kTcpClient:
                launch_thread<
                    goby::middleware::io::TCPClientThreadLineBased<bot_gps_in, bot_gps_out>>(
                    bot_to_gps.bot_id(), bot_to_gps.tcp_client());
                break;
            case jaiabot::config::HubManager::BotToGPS::kTcpServer:
                launch_thread<
                    goby::middleware::io::TCPServerThreadLineBased<bot_gps_in, bot_gps_out>>(
                    bot_to_gps.bot_id(), bot_to_gps.tcp_server());

                break;
            case jaiabot::config::HubManager::BotToGPS::TRANSPORT_NOT_SET: break;
        }

        if (bot_to_gps.transport_case() != jaiabot::config::HubManager::BotToGPS::TRANSPORT_NOT_SET)
            bot_to_gps_ids_.insert(bot_to_gps.bot_id());
    }

    for (auto id : managed_bot_modem_ids_) intervehicle_subscribe(id);

    interprocess().subscribe<jaiabot::groups::hub_command_full>(
        [this](const protobuf::Command& input_command) { handle_command(input_command); });

    interprocess().subscribe<jaiabot::groups::hub_command_full>(
        [this](const protobuf::CommandForHub& input_command_for_hub)
        { handle_command_for_hub(input_command_for_hub); });

    interprocess().subscribe<goby::middleware::groups::health_report>(
        [this](const goby::middleware::protobuf::VehicleHealth& vehicle_health)
        {
            last_health_report_time_ = goby::time::SteadyClock::now();
            jaiabot::health::populate_status_from_health(latest_hub_status_, vehicle_health);
        });

    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv)
        {
            glog.is_debug1() && glog << "Received TimePositionVelocity update: "
                                     << tpv.ShortDebugString() << std::endl;

            if (tpv.device() == cfg().hub_gpsd_device())
            {
                if (tpv.has_location())
                {
                    auto lat = tpv.location().lat_with_units(),
                         lon = tpv.location().lon_with_units();
                    latest_hub_status_.mutable_location()->set_lat_with_units(lat);
                    latest_hub_status_.mutable_location()->set_lon_with_units(lon);
                }
            }
            else if (contact_gps_.count(tpv.device()))
            {
                if (tpv.has_location())
                {
                    protobuf::ContactUpdate update;
                    update.set_contact(contact_gps_[tpv.device()].id);
                    auto lat = tpv.location().lat_with_units(),
                         lon = tpv.location().lon_with_units();
                    update.mutable_location()->set_lat_with_units(lat);
                    update.mutable_location()->set_lon_with_units(lon);
                    if (tpv.has_speed())
                        update.set_speed_over_ground_with_units(tpv.speed_with_units());

                    if (contact_gps_[tpv.device()].use_cog)
                    {
                        if (tpv.has_track())
                            update.set_heading_or_cog_with_units(tpv.track_with_units());
                    }
                    else
                    {
                        auto it = contact_heading_.find(tpv.device());
                        if (it != contact_heading_.end())
                            update.set_heading_or_cog_with_units(it->second);
                    }

                    glog.is_debug2() && glog << group("main") << "Sending contact update: "
                                             << update.ShortDebugString() << std::endl;

                    intervehicle().publish<jaiabot::groups::contact_update>(update);
                }
            }
        });

    interprocess().subscribe<goby::middleware::groups::gpsd::att>(
        [this](const goby::middleware::protobuf::gpsd::Attitude& att)
        {
            glog.is_debug1() && glog << "Received Attitude update: " << att.ShortDebugString()
                                     << std::endl;

            if (att.has_heading())
                contact_heading_[att.device()] = att.heading_with_units();
        });

    // automatically subscribe to bots that send us subscriptions
    interprocess().subscribe<goby::middleware::intervehicle::groups::subscription_report>(
        [this](const goby::middleware::intervehicle::protobuf::SubscriptionReport& report)
        { handle_subscription_report(report); });

    interprocess().subscribe<jaiabot::groups::linux_hardware_status>(
        [this](const jaiabot::protobuf::LinuxHardwareStatus& hardware_status)
        { handle_hardware_status(hardware_status); });
}

jaiabot::apps::HubManager::~HubManager() {}

void jaiabot::apps::HubManager::handle_subscription_report(
    const goby::middleware::intervehicle::protobuf::SubscriptionReport& sub_report)
{
    auto command_dccl_id = jaiabot::protobuf::Command::DCCL_ID;
    if (sub_report.has_changed() && sub_report.changed().dccl_id() == command_dccl_id)
    {
        auto bot_id = sub_report.changed().header().src();

        switch (sub_report.changed().action())
        {
            case goby::middleware::intervehicle::protobuf::Subscription::SUBSCRIBE:
                glog.is_verbose() && glog << group("main") << "Subscribe to bot: " << bot_id
                                          << std::endl;

                managed_bot_modem_ids_.insert(bot_id);
                intervehicle_subscribe(bot_id);

                break;
            case goby::middleware::intervehicle::protobuf::Subscription::UNSUBSCRIBE:
                // do nothing as the bot subscriptions no longer persist across restarts
                // this reduces edge cases problems with unsubscription messages getting through or not
                break;
        }
    }
}

void jaiabot::apps::HubManager::intervehicle_subscribe(int id)
{
    glog.is_verbose() && glog << "Performing intervehicle subscribe actions for bot "
                              << jaiabot::comms::bot_id_from_modem_id(id) << " (modem id " << id
                              << ")" << std::endl;

    {
        goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
        goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
            *subscriber_cfg.mutable_intervehicle();
        intervehicle_cfg.add_publisher_id(id);

        goby::middleware::Subscriber<jaiabot::protobuf::BotStatus> subscriber(subscriber_cfg);

        glog.is_debug1() && glog << "Subscribing to bot_status" << std::endl;

        intervehicle().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
            [this](const jaiabot::protobuf::BotStatus& dccl_nav) { handle_bot_nav(dccl_nav); },
            subscriber);
    }
    {
        goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().task_packet_sub_cfg();
        goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
            *subscriber_cfg.mutable_intervehicle();
        intervehicle_cfg.add_publisher_id(id);

        goby::middleware::Subscriber<jaiabot::protobuf::TaskPacket> subscriber(subscriber_cfg);

        glog.is_debug1() && glog << "Subscribing to task_packet" << std::endl;

        intervehicle().subscribe<jaiabot::groups::task_packet, jaiabot::protobuf::TaskPacket>(
            [this](const jaiabot::protobuf::TaskPacket& task_packet)
            { handle_task_packet(task_packet); },
            subscriber);
    }

    {
        goby::middleware::protobuf::TransporterConfig subscriber_cfg =
            cfg().engineering_status_sub_cfg();
        goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
            *subscriber_cfg.mutable_intervehicle();
        intervehicle_cfg.add_publisher_id(id);

        goby::middleware::Subscriber<jaiabot::protobuf::Engineering> subscriber(subscriber_cfg);

        glog.is_debug1() && glog << "Subscribing to engineering_status" << std::endl;

        intervehicle()
            .subscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::Engineering>(
                [this](const jaiabot::protobuf::Engineering& input_engineering_status)
                {
                    glog.is_debug1() && glog << "Received input_engineering_status: "
                                             << input_engineering_status.ShortDebugString()
                                             << std::endl;

                    auto engineering_status = input_engineering_status;

                    // rewarp the time if needed
                    engineering_status.set_time_with_units(
                        goby::time::convert<goby::time::MicroTime>(goby::time::SystemClock::warp(
                            goby::time::convert<std::chrono::system_clock::time_point>(
                                input_engineering_status.time_with_units()))));

                    interprocess().publish<jaiabot::groups::engineering_status>(engineering_status);
                },
                subscriber);
    }
}

void jaiabot::apps::HubManager::handle_bot_nav(const jaiabot::protobuf::BotStatus& dccl_nav)
{
    glog.is_debug1() && glog << group("bot_nav")
                             << "Received DCCL nav: " << dccl_nav.ShortDebugString() << std::endl;

    // republish for liaison / logger, etc.
    interprocess().publish<jaiabot::groups::bot_status>(dccl_nav);

    goby::middleware::frontseat::protobuf::NodeStatus node_status;

    node_status.set_name("BOT" + std::to_string(dccl_nav.bot_id()));

    // rewarp the time if needed
    node_status.set_time_with_units(goby::time::convert<goby::time::MicroTime>(
        goby::time::SystemClock::warp(goby::time::convert<std::chrono::system_clock::time_point>(
            dccl_nav.time_with_units()))));

    if (dccl_nav.attitude().has_heading())
        node_status.mutable_pose()->set_heading_with_units(
            dccl_nav.attitude().heading_with_units());

    if (dccl_nav.has_location())
    {
        node_status.mutable_global_fix()->set_lat_with_units(dccl_nav.location().lat_with_units());
        node_status.mutable_global_fix()->set_lon_with_units(dccl_nav.location().lon_with_units());
    }

    if (dccl_nav.has_speed())
        node_status.mutable_speed()->set_over_ground_with_units(
            dccl_nav.speed().over_ground_with_units());

    if (dccl_nav.has_depth())
        node_status.mutable_global_fix()->set_depth_with_units(dccl_nav.depth_with_units());

    // publish for opencpn interface
    if (node_status.IsInitialized())
        interprocess().publish<goby::middleware::frontseat::groups::node_status>(node_status);

    if (bot_to_gps_ids_.count(dccl_nav.bot_id()))
    {
        goby::util::gps::RMC rmc;
        goby::util::gps::HDT hdt;

        rmc.time =
            goby::time::convert<goby::time::SystemClock::time_point>(node_status.time_with_units());

        if (dccl_nav.has_location())
            rmc.status = goby::util::gps::RMC::DataValid;
        else
            rmc.status = goby::util::gps::RMC::NavigationReceiverWarning;

        if (dccl_nav.has_location())
        {
            rmc.latitude = dccl_nav.location().lat_with_units();
            rmc.longitude = dccl_nav.location().lon_with_units();
        }
        if (dccl_nav.has_speed())
            rmc.speed_over_ground = dccl_nav.speed().over_ground_with_units();

        if (dccl_nav.attitude().has_course_over_ground())
            rmc.course_over_ground = dccl_nav.attitude().course_over_ground_with_units();

        {
            auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
            io_data->set_index(dccl_nav.bot_id());
            io_data->set_data(rmc.serialize().message_cr_nl());
            interthread().publish<bot_gps_out>(io_data);
        }

        if (dccl_nav.attitude().has_heading())
        {
            hdt.true_heading = dccl_nav.attitude().heading_with_units();
            auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
            io_data->set_index(dccl_nav.bot_id());
            io_data->set_data(hdt.serialize().message_cr_nl());
            interthread().publish<bot_gps_out>(io_data);
        }
    }
}

void jaiabot::apps::HubManager::handle_task_packet(const jaiabot::protobuf::TaskPacket& task_packet)
{
    glog.is_debug1() && glog << group("task_packet")
                             << "Received Task Packet: " << task_packet.ShortDebugString()
                             << std::endl;

    if (task_packet_id_to_prev_timestamp_.count(task_packet.bot_id()))
    {
        auto prev_time = task_packet_id_to_prev_timestamp_.at(task_packet.bot_id());

        // Make sure the taskpacket has a newer timestamp
        // If it is not then we should not handle the taskpacket and exit
        if (prev_time >= task_packet.start_time())
        {
            glog.is_warn() && glog << "Old taskpacket received! Ignoring..." << std::endl;

            // Exit if the previous taskpacket
            // time is greater than the one current one
            return;
        }

        // Store the previous taskpacket time
        task_packet_id_to_prev_timestamp_.at(task_packet.bot_id()) = task_packet.start_time();
    }
    else
    {
        // Insert new bot id to previous task packet time
        task_packet_id_to_prev_timestamp_.insert(
            std::make_pair(task_packet.bot_id(), task_packet.start_time()));
    }

    // Publish interprocess for other goby apps
    interprocess().publish<jaiabot::groups::task_packet>(task_packet);
}

void jaiabot::apps::HubManager::handle_command_for_hub(
    const jaiabot::protobuf::CommandForHub& input_command_for_hub)
{
    glog.is_verbose() && glog << group("main") << "Received Command For Hub: "
                              << input_command_for_hub.ShortDebugString() << std::endl;

    // publish computer shutdown command to jaiabot_health which is run as root so it
    // can actually carry out the shutdown
    switch (input_command_for_hub.type())
    {
        case protobuf::CommandForHub::SCAN_FOR_BOTS:
            if (input_command_for_hub.has_scan_for_bot_id())
            {
                uint32_t modem_id =
                    jaiabot::comms::modem_id_from_bot_id(input_command_for_hub.scan_for_bot_id());
                uint32_t bot_id = input_command_for_hub.scan_for_bot_id();

                glog.is_debug2() && glog << group("main") << "Scan for bot: " << bot_id
                                         << std::endl;

                if (bot_id)
                {
                    glog.is_debug2() &&
                        glog << group("main")
                             << "Check if we are not managing modem id: " << modem_id << std::endl;

                    if (!managed_bot_modem_ids_.count(modem_id))
                    {
                        glog.is_debug2() && glog << group("main")
                                                 << "We are not managing modem id: " << modem_id
                                                 << std::endl;

                        managed_bot_modem_ids_.insert(modem_id);
                        intervehicle_subscribe(modem_id);
                    }
                    else
                    {
                        intervehicle_subscribe(modem_id);
                    }
                }
            }
            break;
        case protobuf::CommandForHub::SHUTDOWN_COMPUTER:
            interprocess().publish<jaiabot::groups::powerstate_command>(input_command_for_hub);
            break;
        case protobuf::CommandForHub::REBOOT_COMPUTER:
            interprocess().publish<jaiabot::groups::powerstate_command>(input_command_for_hub);
            break;
        case protobuf::CommandForHub::RESTART_ALL_SERVICES:
            interprocess().publish<jaiabot::groups::powerstate_command>(input_command_for_hub);
            break;
        default: break;
    }
}

void jaiabot::apps::HubManager::handle_command(const jaiabot::protobuf::Command& input_command)
{
    using protobuf::Command;
    auto command = input_command;
    std::vector<Command> command_fragments;

    //Get the max repeat size from dccl field
    int goal_max_size = protobuf::MissionPlan::descriptor()
                            ->FindFieldByName("goal")
                            ->options()
                            .GetExtension(dccl::field)
                            .max_repeat();
    int fragment_index = 0;
    int goal_max_index = 0;
    int goal_index = 0;

    glog.is_debug1() && glog << group("main")
                             << "Received Full Command: " << input_command.ShortDebugString()
                             << std::endl;

    // Check message type if it is Mission Plan then check the goal size
    // if the goal size is less than the max -> handle as usual
    // Otherwise create command fragments
    if (command.type() == Command::MISSION_PLAN && command.plan().goal_size() > goal_max_size)
    {
        double command_fragments_expected =
            std::ceil((double)command.plan().goal_size() / (double)goal_max_size);

        glog.is_debug1() && glog << group("main") << "Expected: " << command_fragments_expected
                                 << ", Size: " << command.plan().goal_size()
                                 << ", Max Size: " << goal_max_size << std::endl;

        for (fragment_index = 0; fragment_index < command_fragments_expected; fragment_index++)
        {
            glog.is_debug1() && glog << group("main") << "Fragment Index: " << fragment_index
                                     << ", Fragment Expected: " << command_fragments_expected
                                     << std::endl;
            Command command_fragment;
            command_fragment.set_bot_id(command.bot_id());
            command_fragment.set_time(command.time());
            command_fragment.set_type(Command::MISSION_PLAN_FRAGMENT);

            // The initial fragment is going to have more data
            if (command.plan().has_start() && fragment_index == 0)
            {
                command_fragment.mutable_plan()->set_start(command.plan().start());
            }

            if (command.plan().has_movement() && fragment_index == 0)
            {
                command_fragment.mutable_plan()->set_movement(command.plan().movement());
            }

            if (command.plan().has_recovery() && fragment_index == 0)
            {
                *command_fragment.mutable_plan()->mutable_recovery() = command.plan().recovery();
            }

            if (command.plan().has_speeds() && fragment_index == 0)
            {
                *command_fragment.mutable_plan()->mutable_speeds() = command.plan().speeds();
            }

            if (command.plan().has_repeats() && fragment_index == 0)
            {
                command_fragment.mutable_plan()->set_repeats(command.plan().repeats());
            }

            command_fragment.mutable_plan()->set_fragment_index(fragment_index);

            command_fragment.mutable_plan()->set_expected_fragments(command_fragments_expected);

            goal_max_index = goal_max_index + goal_max_size;

            glog.is_debug1() && glog << group("main") << "Goal Index: " << goal_max_index
                                     << ", max size: " << goal_max_size
                                     << ", Total goal size: " << command.plan().goal_size()
                                     << ", Goal index: " << goal_index << std::endl;

            // Loop through goals and add to fragment
            for (; goal_index < command.plan().goal_size(); goal_index++)
            {
                if (goal_index < goal_max_index)
                {
                    glog.is_debug1() && glog << group("main") << "Goal max size: " << goal_max_size
                                             << ", goal index: " << goal_index
                                             << ", Total goal size: " << command.plan().goal_size()
                                             << std::endl;

                    protobuf::MissionPlan::Goal* goal = command_fragment.mutable_plan()->add_goal();
                    if (command.plan().goal(goal_index).has_name())
                    {
                        goal->set_name(command.plan().goal(goal_index).name());
                    }
                    if (command.plan().goal(goal_index).has_task())
                    {
                        *goal->mutable_task() = command.plan().goal(goal_index).task();
                    }
                    *goal->mutable_location() = command.plan().goal(goal_index).location();
                }
                else
                {
                    // Break loop if we reach our max goal index
                    break;
                }
            }
            // Set the next starting index for the next fragment
            goal_index = goal_max_index;

            // Save fragment in vector
            command_fragments.push_back(command_fragment);
        }

        for (auto frag : command_fragments)
        {
            glog.is_debug2() && glog << "fragment: " << frag.DebugString() << std::endl;
        }
    }

    goby::middleware::Publisher<Command> command_publisher(
        {}, [](Command& cmd, const goby::middleware::Group& group)
        { cmd.set_bot_id(group.numeric()); });

    if (!command_fragments.empty())
    {
        // Loop through each fragment and send
        for (const auto& command_fragment : command_fragments)
        {
            glog.is_debug2() && glog << group("main") << "Sending command fragment: "
                                     << command_fragment.ShortDebugString() << std::endl;

            intervehicle().publish_dynamic(
                command_fragment,
                goby::middleware::DynamicGroup(jaiabot::groups::hub_command,
                                               command_fragment.bot_id()),
                command_publisher);
        }
    }
    else
    {
        glog.is_debug2() && glog << group("main")
                                 << "Sending command: " << command.ShortDebugString() << std::endl;

        intervehicle().publish_dynamic(
            command, goby::middleware::DynamicGroup(jaiabot::groups::hub_command, command.bot_id()),
            command_publisher);
    }
}

/**
 * @brief Handle incoming hardware status
 * 
 * @param linux_hardware_status 
 */
void jaiabot::apps::HubManager::handle_hardware_status(
    const jaiabot::protobuf::LinuxHardwareStatus& linux_hardware_status)
{
    *latest_hub_status_.mutable_linux_hardware_status() = linux_hardware_status;
}

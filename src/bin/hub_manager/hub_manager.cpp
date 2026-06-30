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
#undef ECHO

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
#include "jaiabot/intervehicle.h"
#include "jaiabot/messages/comms.pb.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/hub.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/link.pb.h"
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

using BotID = uint32_t;
using MissionCommandTime = uint64_t;

/*
 * This function rounds a timestamp to the nearest DCCL time2 resolution (default 1 second).
 * This is so we can map the incoming mission_command_time, which will have made a round-trip
 * through the dccl.time2 codec to the mission_command_time stored on the Hub for matching
 * with the mission name.
 */
std::uint64_t dccl_time2_round(std::uint64_t ts_micros,
                               std::uint64_t resolution_micros = 1000000ULL)
{
    return ((ts_micros + resolution_micros / 2) / resolution_micros) * resolution_micros;
}

class HubManager : public ApplicationBase
{
  public:
    HubManager();
    ~HubManager();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    void handle_bot_nav(jaiabot::protobuf::BotStatus dccl_nav, bool from_other_hub = false);
    void handle_command(const jaiabot::protobuf::Command& input_command,
                        bool from_other_hub = false);
    void handle_task_packet(const jaiabot::protobuf::TaskPacket& task_packet,
                            bool from_other_hub = false);
    void handle_command_for_hub(const jaiabot::protobuf::CommandForHub& input_command_for_hub);
    void
    handle_hardware_status(const jaiabot::protobuf::LinuxHardwareStatus& linux_hardware_status);

    void handle_subscription_report(
        const goby::middleware::intervehicle::protobuf::SubscriptionReport& report);

    void intervehicle_subscribe(int bot_id, std::set<jaiabot::protobuf::Link> links);
    void hub2hub_subscribe(int other_hub_id);

    void update_vfleet_shutdown_time()
    {
        // multiply by warp factor so the shutdown delay is actual wall time not sim time
        vfleet_shutdown_time_ =
            goby::time::SteadyClock::now() +
            std::chrono::seconds(cfg().app().simulation().time().warp_factor() *
                                 cfg().vfleet().shutdown_after_last_command_seconds());
    }

    void update_vhub_shutdown_time()
    {
        // shutdown the hub when we don't get reports for a time
        vhub_shutdown_time_ = goby::time::SteadyClock::now() +
                              std::chrono::seconds(cfg().app().simulation().time().warp_factor() *
                                                   cfg().vfleet().hub_shutdown_delay_seconds());
    }

    void start_dataoffload(int bot_id);

    void publish_hub2hub_data(jaiabot::protobuf::Hub2HubData* hub2hub_data);
    void handle_hub2hub_data(const jaiabot::protobuf::Hub2HubData& hub2hub_data);

    void set_mission_name_for_bot_command_time(const BotID bot_id,
                                               const MissionCommandTime mission_command_time,
                                               const std::string& mission_name);

    std::string
    get_mission_name_for_bot_command_time(const BotID bot_id,
                                          const MissionCommandTime mission_command_time);

    void process_ack_or_expire(const protobuf::Command& orig_msg, protobuf::Link link,
                               protobuf::CommandCommsResult::CommsResult result);

    bool hub2hub_api_mismatch()
    {
        return (
            hub_errors_.count(protobuf::ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_OTHER_HUB) ||
            hub_errors_.count(protobuf::ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_HUB));
    }

  private:
    jaiabot::protobuf::HubStatus latest_hub_status_;
    goby::time::SteadyClock::time_point last_health_report_time_{std::chrono::seconds(0)};

    std::set<int> managed_bot_ids_;
    std::set<jaiabot::protobuf::Link> links_to_subscribe_on_;

    // Map bot id to previouse task packet timestamp to ignore duplicates
    std::map<uint16_t, std::set<uint64_t>> task_packet_id_to_prev_timestamps_;
    // Map bot id to previouse bot status timestamp to ignore duplicates
    std::map<uint16_t, std::set<uint64_t>> bot_status_id_to_prev_timestamps_;
    // Map bot id to previouse eng status timestamp to ignore duplicates
    std::map<uint16_t, std::set<uint64_t>> eng_status_id_to_prev_timestamps_;
    // only store up to the last N previous command times to avoid
    // large memory usage
    constexpr static std::size_t history_max_count_{100};

    // Map from bot_id => (link => last received time)
    std::map<uint32_t, std::map<jaiabot::protobuf::Link, goby::time::MicroTime>>
        bot_status_link_last_received_;

    bool is_virtualhub_;
    goby::time::SteadyClock::time_point vfleet_shutdown_time_{
        goby::time::SteadyClock::time_point::max()};
    goby::time::SteadyClock::time_point vhub_shutdown_time_{
        goby::time::SteadyClock::time_point::max()};
    goby::time::MicroTime last_command_timestamp_{0 * boost::units::si::micro *
                                                  boost::units::si::seconds};

    // data offload
    // track bot going into DataOffload state
    std::map<int, protobuf::MissionState> latest_bot_mission_state_;
    std::deque<int> bots_pending_data_offload_;
    std::unique_ptr<std::thread> offload_thread_;
    int current_offload_bot_id_{0};
    // used by offload_thread_
    std::atomic<bool> offload_success_{false};
    std::atomic<bool> offload_complete_{false};
    std::atomic<uint32_t> data_offload_percentage_{0};

    // map GPSD device name to contact ID
    struct Contact
    {
        int id;
        bool use_cog;
        goby::time::SteadyClock::time_point next_send_time;
    };

    std::map<std::string, Contact> contact_gps_;
    // map GPSD device name to heading
    std::map<std::string, boost::units::quantity<boost::units::degree::plane_angle>>
        contact_heading_;

    // set of Bot IDs with bot_to_gps in use
    std::set<int> bot_to_gps_ids_;

    std::map<int, goby::time::MicroTime> known_bots_;

    // map mission id to mission name for logging purposes
    std::map<std::pair<BotID, MissionCommandTime>, std::string>
        bot_id_and_command_time_to_mission_name_;

    // map command to expected fragments for result back to web_portal
    struct CommandPending
    {
        // the original command
        protobuf::Command command;
        // for each link we're expected to hear from, which fragments that haven't been acked? (empty set for nonfragmented messages)
        std::map<jaiabot::protobuf::Link, std::set<std::uint32_t>> unacked_fragments_by_link;
    };
    std::set<jaiabot::protobuf::Link>
        active_links_; // which links have we subscribe on at some point?
    std::map<MissionCommandTime, CommandPending> commands_pending_result_;

    std::set<jaiabot::protobuf::Warning> hub_warnings_;
    std::set<jaiabot::protobuf::Error> hub_errors_;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::HubManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::HubManager>(argc, argv));
}

jaiabot::apps::HubManager::HubManager()
    : ApplicationBase(1 * si::hertz), is_virtualhub_(cfg().has_vfleet())
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("hub_status", goby::util::Colors::lt_green);
    glog.add_group("comms", goby::util::Colors::lt_blue);
    glog.add_group("gps", goby::util::Colors::blue);
    glog.add_group("bot_nav", goby::util::Colors::green);
    glog.add_group("hub2hub", goby::util::Colors::magenta);
    glog.add_group("task_packet", goby::util::Colors::lt_magenta);

    latest_hub_status_.set_hub_id(cfg().hub_id());
    latest_hub_status_.set_fleet_id(cfg().fleet_id());

    for (auto contact_gps : cfg().contact_gps())
    {
        contact_gps_.insert(std::make_pair(contact_gps.gpsd_device(),
                                           Contact({contact_gps.contact(), contact_gps.use_cog(),
                                                    goby::time::SteadyClock::now()})));
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

    for (auto link : cfg().link_to_subscribe_on())
        links_to_subscribe_on_.insert(static_cast<jaiabot::protobuf::Link>(link));

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
            glog.is_debug1() && glog << group("gps") << "Received TimePositionVelocity update: "
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
                    Contact& contact_param = contact_gps_[tpv.device()];
                    update.set_contact(contact_param.id);
                    auto lat = tpv.location().lat_with_units(),
                         lon = tpv.location().lon_with_units();
                    update.mutable_location()->set_lat_with_units(lat);
                    update.mutable_location()->set_lon_with_units(lon);
                    if (tpv.has_speed())
                        update.set_speed_over_ground_with_units(tpv.speed_with_units());

                    if (contact_param.use_cog)
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

                    if (goby::time::SteadyClock::now() > contact_param.next_send_time)
                    {
                        glog.is_debug2() && glog << group("main") << "Sending contact update: "
                                                 << update.ShortDebugString() << std::endl;

                        intervehicle().publish<jaiabot::groups::contact_update>(update);

                        contact_param.next_send_time =
                            goby::time::SteadyClock::now() +
                            (std::chrono::seconds(cfg().contact_blackout_seconds()) *
                             managed_bot_ids_
                                 .size()); // spread out contact transmissions based on number of bots. TODO: use broadcast to send contacts if we can.
                    }
                    else
                    {
                        glog.is_debug2() &&
                            glog << group("main")
                                 << "Skipping contact update (not time to send again yet): "
                                 << update.ShortDebugString() << std::endl;
                    }
                }
            }
        });

    interprocess().subscribe<goby::middleware::groups::gpsd::att>(
        [this](const goby::middleware::protobuf::gpsd::Attitude& att)
        {
            glog.is_debug1() && glog << group("gps")
                                     << "Received Attitude update: " << att.ShortDebugString()
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

    interprocess().subscribe<jaiabot::groups::intervehicle_subscribe_request>(
        [this](const jaiabot::protobuf::IntervehicleSubscribeRequest& req)
        {
            if (req.link() == jaiabot::protobuf::LINK_HUB2HUB)
            {
                // subscribe to other hubs
                for (int other_hub_id : cfg().expected_hubs().id())
                {
                    if (other_hub_id != cfg().hub_id())
                        hub2hub_subscribe(other_hub_id);
                }
            }
        });

    if (is_virtualhub_)
        update_vfleet_shutdown_time();
}

jaiabot::apps::HubManager::~HubManager() {}

void jaiabot::apps::HubManager::handle_subscription_report(
    const goby::middleware::intervehicle::protobuf::SubscriptionReport& sub_report)
{
    auto command_dccl_id = jaiabot::protobuf::Command::DCCL_ID;
    auto hub2hub_dccl_id = jaiabot::protobuf::Hub2HubData::DCCL_ID;
    if (sub_report.has_changed())
    {
        if (sub_report.changed().dccl_id() == command_dccl_id)
        {
            auto bot_modem_id = sub_report.changed().header().src();
            auto bot_id = jaiabot::comms::bot_id_from_modem_id(bot_modem_id, cfg().subnet_mask());
            auto link = jaiabot::comms::link_from_modem_id(bot_modem_id, cfg().subnet_mask());

            std::uint32_t bot_api_version =
                intervehicle::api_version_from_hub_command(bot_id, sub_report.changed().group());

            if (bot_api_version == jaiabot::INTERVEHICLE_API_VERSION)
            {
                switch (sub_report.changed().action())
                {
                    case goby::middleware::intervehicle::protobuf::Subscription::SUBSCRIBE:
                        glog.is_verbose() &&
                            glog << group("main") << "Subscribe to bot: " << bot_id << " on link "
                                 << jaiabot::protobuf::Link_Name(link) << std::endl;

                        managed_bot_ids_.insert(bot_id);
                        intervehicle_subscribe(bot_id, {link});
                        break;
                    case goby::middleware::intervehicle::protobuf::Subscription::UNSUBSCRIBE:
                        // do nothing as the bot subscriptions no longer persist across restarts
                        // this reduces edge cases problems with unsubscription messages getting through or not
                        break;
                }
            }
            else
            {
                glog.is_warn() && glog << group("main") << "Bot " << bot_id
                                       << " subscribing with API version " << bot_api_version
                                       << " but hub is using API version "
                                       << jaiabot::INTERVEHICLE_API_VERSION << std::endl;

                jaiabot::protobuf::BotStatus status;
                status.set_bot_id(bot_id);
                status.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
                auto error = bot_api_version < jaiabot::INTERVEHICLE_API_VERSION
                                 ? protobuf::ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_BOT
                                 : protobuf::ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_HUB;
                status.add_error(error);
                hub_errors_.insert(error);
                status.set_health_state(goby::middleware::protobuf::HEALTH__FAILED);

                if (status.has_mission_command_time())
                {
                    status.set_mission_name(get_mission_name_for_bot_command_time(
                        bot_id, status.mission_command_time()));
                }

                interprocess().publish<jaiabot::groups::bot_status>(status);
            }
        }
        else if (sub_report.changed().dccl_id() == hub2hub_dccl_id)
        {
            auto other_hub_modem_id = sub_report.changed().header().src();
            auto link = jaiabot::comms::link_from_modem_id(other_hub_modem_id, cfg().subnet_mask());
            auto other_hub_id =
                jaiabot::comms::hub_id_from_modem_id(other_hub_modem_id, cfg().subnet_mask(), link);
            // group id is the API version for Hub2Hub messages
            std::uint32_t other_hub_api_version = sub_report.changed().group();

            if (other_hub_api_version != jaiabot::INTERVEHICLE_API_VERSION)
            {
                glog.is_warn() && glog << group("main") << "Hub " << other_hub_id
                                       << " subscribing with API version " << other_hub_api_version
                                       << " but this hub is using API version "
                                       << jaiabot::INTERVEHICLE_API_VERSION << std::endl;

                auto error =
                    other_hub_api_version < jaiabot::INTERVEHICLE_API_VERSION
                        ? protobuf::ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_OTHER_HUB
                        : protobuf::ERROR__VERSION__MISMATCH_INTERVEHICLE__UPGRADE_HUB;
                hub_errors_.insert(error);
            }
        }
    }
}

void jaiabot::apps::HubManager::set_mission_name_for_bot_command_time(
    const BotID bot_id, const MissionCommandTime mission_command_time,
    const std::string& mission_name)
{
    auto mission_command_time_dccl = dccl_time2_round(mission_command_time);
    auto bot_and_command_time = std::make_pair(bot_id, mission_command_time_dccl);

    bot_id_and_command_time_to_mission_name_[bot_and_command_time] = mission_name;

    glog.is_debug1() && glog << group("main")
                             << "Set mission name for Bot command time: Bot ID = " << bot_id
                             << ", Command Time = " << mission_command_time_dccl
                             << ", Mission Name = " << mission_name << std::endl;
}

std::string jaiabot::apps::HubManager::get_mission_name_for_bot_command_time(
    const BotID bot_id, const MissionCommandTime mission_command_time)
{
    auto mission_command_time_dccl = dccl_time2_round(mission_command_time);
    auto bot_and_command_time = std::make_pair(bot_id, mission_command_time_dccl);

    if (bot_id_and_command_time_to_mission_name_.count(bot_and_command_time))
    {
        return bot_id_and_command_time_to_mission_name_.at(bot_and_command_time);
    }
    else
    {
        glog.is_warn() && glog << group("main") << "Bot ID = " << bot_id
                               << ", Command Time = " << mission_command_time_dccl
                               << " not found in bot_id_and_command_time_to_mission_name_ mapping"
                               << std::endl;

        for (auto pair : bot_id_and_command_time_to_mission_name_)
        {
            glog.is_warn() && glog << group("main")
                                   << "Known Bot and command time: Bot ID = " << pair.first.first
                                   << ", Command Time = " << pair.first.second
                                   << ", Mission Name = " << pair.second << std::endl;
        }

        return "UNKNOWN_MISSION";
    }
}

void jaiabot::apps::HubManager::intervehicle_subscribe(int bot_id,
                                                       std::set<jaiabot::protobuf::Link> links)
{
    for (auto link : links)
    {
        auto modem_id = jaiabot::comms::modem_id_from_bot_id(bot_id, cfg().subnet_mask(), link);

        glog.is_verbose() && glog << group("comms")
                                  << "Performing intervehicle subscribe actions for bot " << bot_id
                                  << " (modem id " << modem_id << ") on link "
                                  << jaiabot::protobuf::Link_Name(link) << std::endl;

        if (link == jaiabot::protobuf::LINK_UNKNOWN)
        {
            glog.is_warn() && glog << group("comms") << "Cannot subscribe to LINK_UNKNOWN. Ignoring"
                                   << std::endl;
            continue;
        }

        {
            auto set_link_data =
                [this](jaiabot::protobuf::BotStatus& msg,
                       const goby::middleware::intervehicle::protobuf::Header& header)
            { jaiabot::comms::set_link_type(msg, header.src(), cfg().subnet_mask()); };

            goby::middleware::protobuf::TransporterConfig subscriber_cfg;
            *subscriber_cfg.mutable_intervehicle()->mutable_buffer() =
                jaiabot::comms::buffer_for_link(cfg().status_buffer(), link);

            subscriber_cfg.mutable_intervehicle()->add_publisher_id(modem_id);
            goby::middleware::Subscriber<jaiabot::protobuf::BotStatus> subscriber(
                subscriber_cfg,
                intervehicle::default_subscriber_group_func<jaiabot::protobuf::BotStatus>,
                {/*ack func*/}, {/*expire func*/}, set_link_data);

            glog.is_debug1() && glog << group("comms") << "Subscribing to bot_status" << std::endl;

            intervehicle().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
                [this](const jaiabot::protobuf::BotStatus& dccl_nav) { handle_bot_nav(dccl_nav); },
                subscriber);
        }
        {
            auto set_link_data =
                [this](jaiabot::protobuf::TaskPacket& msg,
                       const goby::middleware::intervehicle::protobuf::Header& header)
            { jaiabot::comms::set_link_type(msg, header.src(), cfg().subnet_mask()); };

            goby::middleware::protobuf::TransporterConfig subscriber_cfg;
            *subscriber_cfg.mutable_intervehicle()->mutable_buffer() =
                jaiabot::comms::buffer_for_link(cfg().task_packet_buffer(), link);

            subscriber_cfg.mutable_intervehicle()->add_publisher_id(modem_id);

            goby::middleware::Subscriber<jaiabot::protobuf::TaskPacket> subscriber(
                subscriber_cfg,
                intervehicle::default_subscriber_group_func<jaiabot::protobuf::TaskPacket>,
                {/*ack func*/}, {/*expire func*/}, set_link_data);

            glog.is_debug1() && glog << group("comms") << "Subscribing to task_packet" << std::endl;

            intervehicle().subscribe<jaiabot::groups::task_packet, jaiabot::protobuf::TaskPacket>(
                [this](const jaiabot::protobuf::TaskPacket& task_packet)
                { handle_task_packet(task_packet); }, subscriber);
        }

        {
            auto set_link_data =
                [this](jaiabot::protobuf::Engineering& msg,
                       const goby::middleware::intervehicle::protobuf::Header& header)
            { jaiabot::comms::set_link_type(msg, header.src(), cfg().subnet_mask()); };

            goby::middleware::protobuf::TransporterConfig subscriber_cfg;
            *subscriber_cfg.mutable_intervehicle()->mutable_buffer() =
                jaiabot::comms::buffer_for_link(cfg().engineering_status_buffer(), link);

            subscriber_cfg.mutable_intervehicle()->add_publisher_id(modem_id);

            goby::middleware::Subscriber<jaiabot::protobuf::Engineering> subscriber(
                subscriber_cfg,
                intervehicle::default_subscriber_group_func<jaiabot::protobuf::Engineering>,
                {/*ack func*/}, {/*expire func*/}, set_link_data);

            glog.is_debug1() && glog << group("comms") << "Subscribing to engineering_status"
                                     << std::endl;

            intervehicle()
                .subscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::Engineering>(
                    [this](const jaiabot::protobuf::Engineering& input_engineering_status)
                    {
                        glog.is_debug1() && glog << "Received input_engineering_status: "
                                                 << input_engineering_status.ShortDebugString()
                                                 << std::endl;

                        auto engineering_status = input_engineering_status;

                        // Make sure the engineering_status is not a repeat
                        // If it is, then we should not handle it and exit
                        auto& prev_times =
                            eng_status_id_to_prev_timestamps_[engineering_status.bot_id()];

                        if (prev_times.count(engineering_status.time()))
                        {
                            glog.is_debug1() &&
                                glog << group("engineering_status")
                                     << "Repeat Engineering Status received! Ignoring..."
                                     << std::endl;
                            return;
                        }

                        // Keep track of previous engineering status times per bot to avoid duplicates
                        // (typically from multiple comms links: iridium, wifi, xbee)
                        // If our buffer overflows, remove the smallest (oldest) timestamp
                        while (prev_times.size() >= history_max_count_)
                            prev_times.erase(prev_times.begin());

                        prev_times.insert(engineering_status.time());

                        // rewarp the time if needed
                        engineering_status.set_time_with_units(
                            goby::time::convert<goby::time::MicroTime>(
                                goby::time::SystemClock::warp(
                                    goby::time::convert<std::chrono::system_clock::time_point>(
                                        input_engineering_status.time_with_units()))));

                        interprocess().publish<jaiabot::groups::engineering_status>(
                            engineering_status);
                    },
                    subscriber);
        }

        active_links_.insert(link);
    }
}

void jaiabot::apps::HubManager::hub2hub_subscribe(int other_hub_id)
{
    goby::middleware::protobuf::TransporterConfig subscriber_cfg;
    *subscriber_cfg.mutable_intervehicle()->mutable_buffer() = cfg().hub2hub_buffer();
    auto publisher_modem_id = jaiabot::comms::hub_modem_id(
        cfg().subnet_mask(), jaiabot::protobuf::LINK_HUB2HUB, other_hub_id);
    subscriber_cfg.mutable_intervehicle()->add_publisher_id(publisher_modem_id);

    goby::middleware::Subscriber<jaiabot::protobuf::Hub2HubData> subscriber(
        subscriber_cfg,
        intervehicle::default_subscriber_group_func<jaiabot::protobuf::Hub2HubData>);

    glog.is_debug1() && glog << group("comms")
                             << "Subscribing to hub2hub_data from hub: " << other_hub_id
                             << std::endl;

    intervehicle().subscribe<jaiabot::groups::hub2hub_data, jaiabot::protobuf::Hub2HubData>(
        [this](const jaiabot::protobuf::Hub2HubData& data)
        {
            if (!hub2hub_api_mismatch())
            {
                handle_hub2hub_data(data);
                interprocess().publish<jaiabot::groups::hub2hub_data>(data);
            }
            else
            {
                glog.is_warn() &&
                    glog << group("hub2hub")
                         << "Ignoring hub2hub messages as we have an intervehicle API mismatch"
                         << std::endl;
            }
        },
        subscriber);
}

void jaiabot::apps::HubManager::handle_hub2hub_data(
    const jaiabot::protobuf::Hub2HubData& hub2hub_data)
{
    const uint32_t remote_hub_id = hub2hub_data.hub_id();

    // ignore our own hub2hub data
    if (remote_hub_id == cfg().hub_id())
        return;

    glog.is_debug2() && glog << group("hub2hub")
                             << "Received Hub2HubData: " << hub2hub_data.ShortDebugString()
                             << std::endl;

    switch (hub2hub_data.contents_case())
    {
        case jaiabot::protobuf::Hub2HubData::kBotStatus:
        {
            auto message = hub2hub_data.bot_status();
            if (hub2hub_data.has_bot_link())
                message.set_link(hub2hub_data.bot_link());
            handle_bot_nav(message, true);
            break;
        }
        case jaiabot::protobuf::Hub2HubData::kTaskPacket:
        {
            auto message = hub2hub_data.task_packet();
            if (hub2hub_data.has_bot_link())
                message.set_link(hub2hub_data.bot_link());
            handle_task_packet(message, true);
            break;
        }
        case jaiabot::protobuf::Hub2HubData::kCommandForBot:
        {
            handle_command(hub2hub_data.command_for_bot(), true);

            auto remote_command = hub2hub_data.command_for_bot();
            remote_command.set_from_hub_id(hub2hub_data.hub_id());
            interprocess().publish<jaiabot::groups::remote_hub_command>(remote_command);

            break;
        }

        case jaiabot::protobuf::Hub2HubData::kCommandCommsResult:
        {
            interprocess().publish<groups::hub_command_result>(hub2hub_data.command_comms_result());
            break;
        }

        case jaiabot::protobuf::Hub2HubData::kHubStatus:
        {
            interprocess().publish<jaiabot::groups::hub_status>(hub2hub_data.hub_status());
            break;
        }

        case jaiabot::protobuf::Hub2HubData::CONTENTS_NOT_SET: break;
    }
}

void jaiabot::apps::HubManager::loop()
{
    latest_hub_status_.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

    if (offload_thread_)
    {
        latest_hub_status_.mutable_bot_offload()->set_bot_id(current_offload_bot_id_);
        latest_hub_status_.mutable_bot_offload()->set_data_offload_percentage(
            data_offload_percentage_);
        for (int bot_id : bots_pending_data_offload_)
        {
            latest_hub_status_.mutable_bot_offload()->add_bots_pending(bot_id);
        }

        if (offload_complete_)
        {
            offload_thread_->join();
            protobuf::Command command;
            command.set_bot_id(current_offload_bot_id_);
            // JCC sends timestamps unwarped, so do the same to avoid sending "newer" timestamp than future JCC command
            command.set_time_with_units(goby::time::convert<goby::time::MicroTime>(
                goby::time::SystemClock::unwarp(goby::time::SystemClock::now())));
            if (offload_success_)
            {
                latest_hub_status_.mutable_bot_offload()->set_offload_succeeded(true);
                command.set_type(protobuf::Command::DATA_OFFLOAD_COMPLETE);
            }
            else
            {
                latest_hub_status_.mutable_bot_offload()->set_offload_succeeded(false);
                command.set_type(protobuf::Command::DATA_OFFLOAD_FAILED);
            }
            handle_command(command);
            offload_thread_.reset();
        }
    }
    else if (!offload_thread_ && !bots_pending_data_offload_.empty())
    {
        start_dataoffload(bots_pending_data_offload_.front());
        bots_pending_data_offload_.pop_front();
    }

    if (last_health_report_time_ + std::chrono::seconds(cfg().health_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << group("main") << "Timeout on health report" << std::endl;
        latest_hub_status_.set_health_state(goby::middleware::protobuf::HEALTH__FAILED);
        latest_hub_status_.clear_error();
        latest_hub_status_.add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_HEALTH);
    }

    latest_hub_status_.clear_known_bot();
    for (const auto& known_bot_p : known_bots_)
    {
        auto* known_bot = latest_hub_status_.add_known_bot();
        known_bot->set_id(known_bot_p.first);
        known_bot->set_last_status_time_with_units(known_bot_p.second);
    }

    latest_hub_status_.clear_active_link();
    for (auto link : active_links_) { latest_hub_status_.add_active_link(link); }

    if (latest_hub_status_.IsInitialized())
    {
        glog.is_debug1() && glog << group("hub_status") << "Publishing hub status: "
                                 << latest_hub_status_.ShortDebugString() << std::endl;
        interprocess().publish<jaiabot::groups::hub_status>(latest_hub_status_);

        // republish for other hubs
        jaiabot::protobuf::Hub2HubData hub2hub_data;
        *hub2hub_data.mutable_hub_status() = latest_hub_status_;
        publish_hub2hub_data(&hub2hub_data);
    }

    if (is_virtualhub_)
    {
        if (goby::time::SteadyClock::now() > vfleet_shutdown_time_)
        {
            glog.is_warn() && glog << group("main") << "Seconds ("
                                   << cfg().vfleet().shutdown_after_last_command_seconds()
                                   << ") since last command exceeded, shutting down VirtualFleet "
                                      "to save on EC2 costs"
                                   << std::endl;

            for (auto bot_id : managed_bot_ids_)
            {
                {
                    jaiabot::protobuf::Command cmd;
                    cmd.set_bot_id(bot_id);
                    cmd.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
                    cmd.set_type(jaiabot::protobuf::Command::STOP);
                    handle_command(cmd);
                }
                {
                    jaiabot::protobuf::Command cmd;
                    cmd.set_bot_id(bot_id);
                    cmd.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
                    cmd.set_type(jaiabot::protobuf::Command::SHUTDOWN_COMPUTER);
                    handle_command(cmd);
                }
            }
        }
        if (goby::time::SteadyClock::now() > vhub_shutdown_time_)
        {
            glog.is_warn() && glog << group("main") << "Shutting down this VirtualHub" << std::endl;
            jaiabot::protobuf::CommandForHub cmd;
            cmd.set_hub_id(cfg().hub_id());
            cmd.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
            cmd.set_type(jaiabot::protobuf::CommandForHub::SHUTDOWN_COMPUTER);
            handle_command_for_hub(cmd);
        }
    }

    latest_hub_status_.clear_bot_offload();
}

void jaiabot::apps::HubManager::handle_bot_nav(jaiabot::protobuf::BotStatus dccl_nav,
                                               bool from_other_hub)
{
    glog.is_debug1() && glog << group("bot_nav")
                             << "Received DCCL nav: " << dccl_nav.ShortDebugString() << std::endl;

    if (!from_other_hub)
    {
        // republish for other hubs
        jaiabot::protobuf::Hub2HubData hub2hub_data;
        *hub2hub_data.mutable_bot_status() = dccl_nav;
        if (dccl_nav.has_link())
            hub2hub_data.set_bot_link(dccl_nav.link());
        publish_hub2hub_data(&hub2hub_data);
    }

    // Make sure the bot_status is not a repeat
    // If it is, then we should not handle it and exit
    auto& prev_times = bot_status_id_to_prev_timestamps_[dccl_nav.bot_id()];

    // Update the last-received time for this link on a fresh status
    // Even if we determine it's a duplicate based on the timestamp,
    // we still want to update the last-received time for this link to ensure accurate tracking of link age
    if (dccl_nav.has_link())
        bot_status_link_last_received_[dccl_nav.bot_id()][dccl_nav.link()] =
            goby::time::SystemClock::now<goby::time::MicroTime>();

    if (prev_times.count(dccl_nav.time()))
    {
        glog.is_debug1() && glog << group("bot_status") << "Repeat Bot Status received on link: "
                                 << jaiabot::protobuf::Link_Name(dccl_nav.link()) << "! Ignoring..."
                                 << std::endl;

        return;
    }

    // Stamp all last-received times into the proto
    // so the portal always has up-to-date link age data
    auto& link_times = bot_status_link_last_received_[dccl_nav.bot_id()];
    for (auto& active_link : *dccl_nav.mutable_active_links())
    {
        auto it = link_times.find(active_link.link());
        if (it != link_times.end())
            active_link.set_last_received_time(it->second.value());
    }

    // Keep track of previous bot status times per bot to avoid duplicates
    // (typically from multiple comms links: iridium, wifi, xbee)
    // If our buffer overflows, remove the smallest (oldest) timestamp
    while (prev_times.size() >= history_max_count_) prev_times.erase(prev_times.begin());

    prev_times.insert(dccl_nav.time());

    // don't shut down the hub while we have bots reporting to us
    if (is_virtualhub_)
        update_vhub_shutdown_time();

    if (dccl_nav.has_mission_command_time())
    {
        dccl_nav.set_mission_name(get_mission_name_for_bot_command_time(
            dccl_nav.bot_id(), dccl_nav.mission_command_time()));
    }

    // republish for liaison / logger, etc.
    interprocess().publish<jaiabot::groups::bot_status>(dccl_nav);

    goby::middleware::frontseat::protobuf::NodeStatus node_status;

    node_status.set_name("BOT" + std::to_string(dccl_nav.bot_id()));

    // rewarp the time if needed
    auto rewarped_dccl_nav_time = goby::time::convert<goby::time::MicroTime>(
        goby::time::SystemClock::warp(goby::time::convert<std::chrono::system_clock::time_point>(
            dccl_nav.time_with_units())));

    node_status.set_time_with_units(rewarped_dccl_nav_time);

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

    if (dccl_nav.has_sensor_depth())
        node_status.mutable_global_fix()->set_depth_with_units(dccl_nav.sensor_depth_with_units());

    // check for data offload

    auto previous_mission_state = latest_bot_mission_state_.count(dccl_nav.bot_id())
                                      ? latest_bot_mission_state_.at(dccl_nav.bot_id())
                                      : protobuf::PRE_DEPLOYMENT__STARTING_UP;

    if (dccl_nav.mission_state() == protobuf::POST_DEPLOYMENT__DATA_OFFLOAD &&
        previous_mission_state != protobuf::POST_DEPLOYMENT__DATA_OFFLOAD)
    {
        glog.is_debug1() && glog << group("main") << "Queuing offload for bot " << dccl_nav.bot_id()
                                 << std::endl;
        bots_pending_data_offload_.push_back(dccl_nav.bot_id());
    }

    latest_bot_mission_state_[dccl_nav.bot_id()] = dccl_nav.mission_state();

    if (rewarped_dccl_nav_time > known_bots_[dccl_nav.bot_id()])
        known_bots_[dccl_nav.bot_id()] = rewarped_dccl_nav_time;

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

void jaiabot::apps::HubManager::handle_task_packet(const jaiabot::protobuf::TaskPacket& task_packet,
                                                   bool from_other_hub)
{
    glog.is_debug1() && glog << group("task_packet")
                             << "Received Task Packet: " << task_packet.ShortDebugString()
                             << std::endl;

    if (!from_other_hub)
    {
        // Share task packet with other hubs via Hub2HubData
        jaiabot::protobuf::Hub2HubData hub2hub_data;
        *hub2hub_data.mutable_task_packet() = task_packet;
        if (task_packet.has_link())
            hub2hub_data.set_bot_link(task_packet.link());
        publish_hub2hub_data(&hub2hub_data);
    }

    // Make sure the taskpacket is not a repeat
    // If it is, then we should not handle it and exit
    auto& prev_times = task_packet_id_to_prev_timestamps_[task_packet.bot_id()];

    if (prev_times.count(task_packet.start_time()))
    {
        glog.is_debug1() && glog << group("task_packet")
                                 << "Repeat taskpacket received! Ignoring..." << std::endl;
        return;
    }

    // Keep track of previous task packet times per bot to avoid duplicates
    // (typically from multiple comms links: iridium, wifi, xbee)
    // If our buffer overflows, remove the smallest (oldest) timestamp
    while (prev_times.size() >= history_max_count_) prev_times.erase(prev_times.begin());

    prev_times.insert(task_packet.start_time());

    // Set the mission_name of the task packet based on the current mission id to name mapping for logging purposes
    jaiabot::protobuf::TaskPacket task_packet_copy = task_packet;

    // Use the last_command_time and the bot_id to fill in the mission_name field
    if (task_packet.has_bot_id() && task_packet.has_mission_command_time())
    {
        task_packet_copy.set_mission_name(get_mission_name_for_bot_command_time(
            task_packet.bot_id(), task_packet.mission_command_time()));
    }

    // Publish interprocess for other goby apps
    interprocess().publish<jaiabot::groups::task_packet>(task_packet_copy);
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
                uint32_t bot_id = input_command_for_hub.scan_for_bot_id();

                glog.is_debug2() && glog << group("main") << "Scan for bot: " << bot_id
                                         << std::endl;

                if (bot_id)
                {
                    glog.is_debug2() && glog << group("main")
                                             << "Check if we are not managing bot id: " << bot_id
                                             << std::endl;

                    if (!managed_bot_ids_.count(bot_id))
                    {
                        glog.is_debug2() && glog << group("main")
                                                 << "We are not managing bot id: " << bot_id
                                                 << std::endl;

                        managed_bot_ids_.insert(bot_id);
                        intervehicle_subscribe(bot_id, links_to_subscribe_on_);
                    }
                    else
                    {
                        intervehicle_subscribe(bot_id, links_to_subscribe_on_);
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

void jaiabot::apps::HubManager::handle_command(const jaiabot::protobuf::Command& input_command,
                                               bool from_other_hub)
{
    glog.is_debug1() && glog << group("main")
                             << "Received Full Command: " << input_command.ShortDebugString()
                             << std::endl;

    if (!from_other_hub)
    {
        jaiabot::protobuf::Hub2HubData hub2hub_data;
        *hub2hub_data.mutable_command_for_bot() = input_command;
        publish_hub2hub_data(&hub2hub_data);
    }

    if (is_virtualhub_)
        update_vfleet_shutdown_time();

    using protobuf::Command;
    auto command = input_command;
    command.set_from_hub_id(cfg().hub_id());

    // check that timestamp is unique within DCCL rounding and bump forward by a second
    // if necessary so that mission manager doesn't reject valid commands
    // This is only an issue with automated commands and super-human operators who send commands < 1 second apart
    const int command_time_precision = protobuf::Command::descriptor()
                                           ->FindFieldByName("time")
                                           ->options()
                                           .GetExtension(dccl::field)
                                           .precision();
    const double div = std::pow(10, -command_time_precision);
    const double t1 = last_command_timestamp_.value(),
                 t2 = command.time_with_units<goby::time::MicroTime>().value();
    if (static_cast<std::uint64_t>(std::round(t1 / div)) >=
        static_cast<std::uint64_t>(std::round(t2 / div)))
    {
        std::uint64_t t3 = t1 + div;
        glog.is_debug1() && glog << group("main") << "Command has the same or newer timestamp ("
                                 << static_cast<std::uint64_t>(t2) << ") as previous command ("
                                 << static_cast<std::uint64_t>(t1)
                                 << ") within rounding, fudging new timestamp to: " << t3
                                 << std::endl;
        command.set_time_with_units(t3 * boost::units::si::micro * boost::units::si::seconds);
    }
    last_command_timestamp_ = command.time_with_units<goby::time::MicroTime>();

    if (command.has_plan())
    {
        set_mission_name_for_bot_command_time(command.bot_id(), command.time(),
                                              command.plan().mission_name());
    }

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

    // Check message type if it is Mission Plan then check the goal size
    // if the goal size is less than the max -> handle as usual
    // Otherwise create command fragments
    std::set<std::uint32_t> unacked_fragments;
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
            auto mutable_plan = command_fragment.mutable_plan();

            // The initial fragment is going to have more data
            if (fragment_index == 0)
            {
                if (command.plan().has_start())
                {
                    mutable_plan->set_start(command.plan().start());
                }
                if (command.plan().has_movement())
                {
                    mutable_plan->set_movement(command.plan().movement());
                }
                if (command.plan().has_recovery())
                {
                    *mutable_plan->mutable_recovery() = command.plan().recovery();
                }
                if (command.plan().has_speeds())
                {
                    *mutable_plan->mutable_speeds() = command.plan().speeds();
                }
                if (command.plan().has_repeats())
                {
                    mutable_plan->set_repeats(command.plan().repeats());
                }
                if (command.plan().has_bottom_depth_safety_params())
                {
                    *mutable_plan->mutable_bottom_depth_safety_params() =
                        command.plan().bottom_depth_safety_params();
                }
                if (command.plan().has_mission_name())
                {
                    mutable_plan->set_mission_name(command.plan().mission_name());
                }
                if (command.plan().segments_size() > 0) {
                    for (const auto& segment : command.plan().segments())
                    {
                        *mutable_plan->add_segments() = segment;
                    }
                }
            }

            mutable_plan->set_fragment_index(fragment_index);
            unacked_fragments.insert(fragment_index);

            mutable_plan->set_expected_fragments(command_fragments_expected);

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

                    protobuf::MissionPlan::Goal* goal = mutable_plan->add_goal();
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
            glog.is_debug2() && glog << group("main") << "fragment: " << frag.DebugString()
                                     << std::endl;
        }
    }

    // store this command and (if relevant, set of fragments)
    // so we can assemble the acks for fragmented commands and send one ack/expire back to web_portal
    // Goby currently returns DCCL-rounded messages in ack, so we store the rounded timestamp here
    auto command_time_dccl = dccl_time2_round(command.time());

    std::map<jaiabot::protobuf::Link, std::set<std::uint32_t>> unacked_fragments_by_link;
    for (auto link : active_links_) unacked_fragments_by_link[link] = unacked_fragments;

    commands_pending_result_[command_time_dccl] =
        CommandPending({command, unacked_fragments_by_link});
    glog.is_debug1() &&
        glog << group("comms")
             << "Inserting Command result pending for command with time: " << command_time_dccl
             << ", command: " << command.ShortDebugString() << std::endl;

    // see intervehicle.h comment for default_publisher
    auto dummy_group_func = [](protobuf::Command&, const goby::middleware::Group&) {};

    auto on_command_ack = [this](const protobuf::Command& orig_msg,
                                 const goby::middleware::intervehicle::protobuf::AckData& ack_msg)
    {
        glog.is_debug2() && glog << group("comms") << "Ack: " << ack_msg.ShortDebugString()
                                 << " for " << orig_msg.ShortDebugString() << std::endl;

        for (auto dest : ack_msg.header().dest())
        {
            auto link = jaiabot::comms::link_from_modem_id(dest, cfg().subnet_mask());
            if (link != protobuf::LINK_HUB2HUB)
                process_ack_or_expire(orig_msg, link, protobuf::CommandCommsResult::SUCCESS);
        }
    };

    auto on_command_expire =
        [this](const protobuf::Command& orig_msg,
               const goby::middleware::intervehicle::protobuf::ExpireData& expire_msg)
    {
        glog.is_debug2() && glog << group("comms") << "Expire: " << expire_msg.ShortDebugString()
                                 << " for " << orig_msg.ShortDebugString() << std::endl;
        for (auto dest : expire_msg.header().dest())
        {
            auto link = jaiabot::comms::link_from_modem_id(dest, cfg().subnet_mask());
            if (link != protobuf::LINK_HUB2HUB)
                process_ack_or_expire(orig_msg, link, protobuf::CommandCommsResult::FAILURE);
        }
    };

    goby::middleware::Publisher<protobuf::Command> command_publisher(
        {}, dummy_group_func, on_command_ack, on_command_expire);

    if (!command_fragments.empty())
    {
        // Loop through each fragment and send
        for (const auto& command_fragment : command_fragments)
        {
            glog.is_debug2() && glog << group("main") << "Sending command fragment: "
                                     << command_fragment.ShortDebugString() << std::endl;

            intervehicle().publish_dynamic(
                command_fragment, intervehicle::hub_command_group(command_fragment.bot_id()),
                command_publisher);
        }
    }
    else
    {
        glog.is_debug2() && glog << group("main")
                                 << "Sending command: " << command.ShortDebugString() << std::endl;

        intervehicle().publish_dynamic(command, intervehicle::hub_command_group(command.bot_id()),
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

void jaiabot::apps::HubManager::start_dataoffload(int bot_id)
{
    glog.is_verbose() && glog << group("main") << "Starting offload for bot " << bot_id
                              << std::endl;
    current_offload_bot_id_ = bot_id;

    std::string bot_ip = cfg().class_b_network() + "." + std::to_string(cfg().fleet_id()) + "." +
                         std::to_string((cfg().bot_start_ip() + bot_id));

    if (cfg().use_localhost_for_data_offload())
        bot_ip = "127.0.0.1";

    std::string offload_command = cfg().data_offload_script() + " " + cfg().log_staging_dir() +
                                  " " + cfg().log_offload_dir() + " " + bot_ip + " 2>&1";

    auto offload_func = [this, offload_command]()
    {
        // reset data offload global variables
        offload_complete_ = false;
        offload_success_ = false;

        glog.is_debug1() && glog << group("main") << "Offloading data with command: ["
                                 << offload_command << "]" << std::endl;

        FILE* pipe = popen(offload_command.c_str(), "r");
        if (!pipe)
        {
            glog.is_warn() && glog << group("main")
                                   << "Error opening pipe to data offload command: "
                                   << strerror(errno) << std::endl;
        }
        else
        {
            std::string stdout;
            std::array<char, 256> buffer;
            while (auto bytes_read = fread(buffer.data(), sizeof(char), buffer.size(), pipe))
            {
                glog.is_debug1() && glog << std::string(buffer.begin(), buffer.begin() + bytes_read)
                                         << std::flush;
                stdout.append(buffer.begin(), buffer.begin() + bytes_read);

                // Check if the line contains progress information
                std::string percent_complete_str = "";
                percent_complete_str.append(buffer.begin(), buffer.begin() + bytes_read);
                size_t pos = percent_complete_str.rfind("%");
                if (pos != std::string::npos)
                {
                    if (pos >= 3)
                    {
                        glog.is_debug2() && glog << percent_complete_str.substr(pos - 3, 3) << "%"
                                                 << std::endl;

                        uint32_t percent = std::stoi(percent_complete_str.substr(pos - 3, 3));
                        data_offload_percentage_ = percent;
                    }
                }
            }

            if (!feof(pipe))
            {
                pclose(pipe);
                glog.is_warn() && glog
                                      << group("main")
                                      << "Error reading output while executing data offload command"
                                      << std::endl;
            }
            else
            {
                int status = pclose(pipe);
                if (status < 0)
                {
                    glog.is_warn() &&
                        glog << group("main")
                             << "Error executing data offload command: " << strerror(errno)
                             << ", output: " << stdout << std::endl;
                }
                else
                {
                    if (WIFEXITED(status))
                    {
                        int exit_status = WEXITSTATUS(status);
                        if (exit_status == 0)
                            offload_success_ = true;
                        else
                            glog.is_warn() &&
                                glog << group("main")
                                     << "Error: Offload command returned normally but with "
                                        "non-zero exit code "
                                     << exit_status << ", output: " << stdout << std::endl;
                    }

                    else
                    {
                        glog.is_warn() &&
                            glog << group("main")
                                 << "Error: Offload command exited abnormally. output: " << stdout
                                 << std::endl;
                    }
                }
            }
        }
        offload_complete_ = true;
    };

    offload_thread_.reset(new std::thread(offload_func));
}

void jaiabot::apps::HubManager::publish_hub2hub_data(jaiabot::protobuf::Hub2HubData* hub2hub_data)
{
    if (!hub2hub_api_mismatch())
    {
        hub2hub_data->set_hub_id(cfg().hub_id());
        hub2hub_data->set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        intervehicle().publish<jaiabot::groups::hub2hub_data>(
            *hub2hub_data, intervehicle::default_publisher<jaiabot::protobuf::Hub2HubData>);
    }
    else
    {
        glog.is_warn() &&
            glog << group("hub2hub")
                 << "Not publishing hub2hub messages as we have an intervehicle API mismatch"
                 << std::endl;
    }
}

void jaiabot::apps::HubManager::process_ack_or_expire(
    const protobuf::Command& orig_msg, protobuf::Link link,
    protobuf::CommandCommsResult::CommsResult result)
{
    auto command_time_dccl = dccl_time2_round(orig_msg.time());

    glog.is_debug1() && glog << group("comms") << "Received result "
                             << protobuf::CommandCommsResult::CommsResult_Name(result)
                             << " for command time " << command_time_dccl << " on link "
                             << jaiabot::protobuf::Link_Name(link) << std::endl;

    auto pending_it = commands_pending_result_.find(command_time_dccl);

    auto publish_result = [this, &pending_it, &link, &result, &command_time_dccl]()
    {
        protobuf::CommandCommsResult result_msg;
        *result_msg.mutable_orig_command() = pending_it->second.command;
        result_msg.set_result(result);
        result_msg.set_link(link);
        interprocess().publish<groups::hub_command_result>(result_msg);

        // Share comms result with other hubs via Hub2HubData
        jaiabot::protobuf::Hub2HubData hub2hub_data;
        *hub2hub_data.mutable_command_comms_result() = result_msg;
        publish_hub2hub_data(&hub2hub_data);

        pending_it->second.unacked_fragments_by_link.erase(link);
        if (pending_it->second.unacked_fragments_by_link.empty())
        {
            glog.is_debug1() &&
                glog << group("comms") << "All links heard from for command at time "
                     << command_time_dccl << "; erasing from pending result map." << std::endl;
            commands_pending_result_.erase(pending_it);
        }
    };

    if (pending_it != commands_pending_result_.end())
    {
        if (orig_msg.type() == protobuf::Command::MISSION_PLAN_FRAGMENT)
        {
            glog.is_debug1() && glog << group("comms") << "Received comms "
                                     << protobuf::CommandCommsResult::CommsResult_Name(result)
                                     << " for MISSION_PLAN_FRAGMENT: "
                                     << orig_msg.plan().fragment_index() << std::endl;

            if (result == protobuf::CommandCommsResult::FAILURE)
            {
                // any fragment expire is a full message failure
                publish_result();
            }
            else
            {
                auto& unacked_fragments = pending_it->second.unacked_fragments_by_link[link];
                unacked_fragments.erase(orig_msg.plan().fragment_index());
                if (unacked_fragments.empty())
                {
                    // all fragments acked, success
                    publish_result();
                }
            }
        }
        else
        {
            glog.is_debug1() && glog << group("comms") << "Received comms "
                                     << protobuf::CommandCommsResult::CommsResult_Name(result)
                                     << " for unfragmented Command" << std::endl;

            // unfragmented message maps onto singular ack/expire
            publish_result();
        }
    }
    else
    {
        // possible to get some extra fragment acks/expires after we failed a message due to a failed fragment
        if (orig_msg.type() != protobuf::Command::MISSION_PLAN_FRAGMENT)
        {
            glog.is_warn() && glog << group("comms") << "Received comms result "
                                   << protobuf::CommandCommsResult::CommsResult_Name(result)
                                   << " that we weren't expecting for command message: "
                                   << orig_msg.ShortDebugString() << std::endl;
        }
    }
}

void jaiabot::apps::HubManager::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    health.set_state(goby::middleware::protobuf::HEALTH__OK);

    for (const auto& w : hub_warnings_)
    {
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)->add_warning(w);
        health.set_state(goby::middleware::protobuf::HEALTH__DEGRADED);
    }

    for (const auto& e : hub_errors_)
    {
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)->add_error(e);
        health.set_state(goby::middleware::protobuf::HEALTH__FAILED);
    }
}

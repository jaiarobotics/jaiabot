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
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/health/health.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/hub.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/mission.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::HubManager>;

namespace jaiabot
{
namespace apps
{
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

  private:
    jaiabot::protobuf::HubStatus latest_hub_status_;
    goby::time::SteadyClock::time_point last_health_report_time_{std::chrono::seconds(0)};
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::HubManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::HubManager>(argc, argv));
}

jaiabot::apps::HubManager::HubManager() : ApplicationBase(2 * si::hertz)
{
    latest_hub_status_.set_hub_id(cfg().hub_id());

    for (auto id : cfg().managed_bot_modem_id())
    {
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
            goby::middleware::protobuf::TransporterConfig subscriber_cfg =
                cfg().task_packet_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::TaskPacket> subscriber(subscriber_cfg);

            glog.is_debug1() && glog << "Subscribing to task_packet" << std::endl;

            intervehicle().subscribe<jaiabot::groups::task_packet, jaiabot::protobuf::TaskPacket>(
                [this](const jaiabot::protobuf::TaskPacket& task_packet) {
                    handle_task_packet(task_packet);
                },
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
                    [this](const jaiabot::protobuf::Engineering& input_engineering_status) {
                        glog.is_debug1() && glog << "Received input_engineering_status: "
                                                 << input_engineering_status.ShortDebugString()
                                                 << std::endl;

                        auto engineering_status = input_engineering_status;

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
    }
    interprocess().subscribe<jaiabot::groups::hub_command_full>(
        [this](const protobuf::Command& input_command) { handle_command(input_command); });

    interprocess().subscribe<goby::middleware::groups::health_report>(
        [this](const goby::middleware::protobuf::VehicleHealth& vehicle_health) {
            last_health_report_time_ = goby::time::SteadyClock::now();
            jaiabot::health::populate_status_from_health(latest_hub_status_, vehicle_health);
        });

    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            glog.is_debug1() && glog << "Received TimePositionVelocity update: "
                                     << tpv.ShortDebugString() << std::endl;

            if (tpv.has_location())
            {
                auto lat = tpv.location().lat_with_units(), lon = tpv.location().lon_with_units();
                latest_hub_status_.mutable_location()->set_lat_with_units(lat);
                latest_hub_status_.mutable_location()->set_lon_with_units(lon);
            }
        });
}

jaiabot::apps::HubManager::~HubManager()
{
    for (auto id : cfg().managed_bot_modem_id())
    {
        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::BotStatus> subscriber(subscriber_cfg);

            intervehicle().unsubscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
                subscriber);
        }
        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg =
                cfg().task_packet_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::TaskPacket> subscriber(subscriber_cfg);

            intervehicle().unsubscribe<jaiabot::groups::bot_status, jaiabot::protobuf::TaskPacket>(
                subscriber);
        }

        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::Engineering> subscriber(subscriber_cfg);

            intervehicle()
                .unsubscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::Engineering>(
                    subscriber);
        }
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
}

void jaiabot::apps::HubManager::handle_task_packet(const jaiabot::protobuf::TaskPacket& task_packet)
{
    glog.is_debug1() && glog << group("task_packet")
                             << "Received Task Packet: " << task_packet.ShortDebugString()
                             << std::endl;

    // republish
    interprocess().publish<jaiabot::groups::task_packet>(task_packet);
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

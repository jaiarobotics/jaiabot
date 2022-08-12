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
#include <goby/middleware/protobuf/frontseat_data.pb.h>

#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/engineering.pb.h"
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
    void handle_bot_nav(const jaiabot::protobuf::BotStatus& dccl_nav);
    void handle_dive_packet(const jaiabot::protobuf::DivePacket& dive_packet);
    void handle_command(const jaiabot::protobuf::Command& input_command);
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::HubManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::HubManager>(argc, argv));
}

jaiabot::apps::HubManager::HubManager()
{
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
                cfg().dive_packet_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::DivePacket> subscriber(subscriber_cfg);

            glog.is_debug1() && glog << "Subscribing to dive_packet" << std::endl;

            intervehicle().subscribe<jaiabot::groups::dive_packet, jaiabot::protobuf::DivePacket>(
                [this](const jaiabot::protobuf::DivePacket& dive_packet)
                { handle_dive_packet(dive_packet); },
                subscriber);
        }

        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::Engineering> subscriber(subscriber_cfg);

            glog.is_debug1() && glog << "Subscribing to engineering_status" << std::endl;

            intervehicle().subscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::Engineering>(
                [this](const jaiabot::protobuf::Engineering& input_engineering_status) {
                    glog.is_debug1() && glog << "Received input_engineering_status: " << input_engineering_status.ShortDebugString() << std::endl;

                    auto engineering_status = input_engineering_status;

                    // rewarp the time if needed
                    engineering_status.set_time_with_units(goby::time::convert<goby::time::MicroTime>(
                    goby::time::SystemClock::warp(goby::time::convert<std::chrono::system_clock::time_point>(
                    input_engineering_status.time_with_units()))));

                    interprocess().publish<jaiabot::groups::engineering_status>(engineering_status);
                },
                subscriber);
        }
    }
    interprocess().subscribe<jaiabot::groups::hub_command_full>(
        [this](const protobuf::Command& input_command) { handle_command(input_command); });
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
                cfg().dive_packet_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::DivePacket> subscriber(subscriber_cfg);

            intervehicle().unsubscribe<jaiabot::groups::bot_status, jaiabot::protobuf::DivePacket>(
                subscriber);
        }

        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::Engineering> subscriber(subscriber_cfg);

            intervehicle().unsubscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::Engineering>(
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

void jaiabot::apps::HubManager::handle_dive_packet(const jaiabot::protobuf::DivePacket& dive_packet)
{
    glog.is_debug1() && glog << group("dive_packet")
                             << "Received Dive packet: " << dive_packet.ShortDebugString()
                             << std::endl;

    // republish
    interprocess().publish<jaiabot::groups::dive_packet>(dive_packet);
}

void jaiabot::apps::HubManager::handle_command(const jaiabot::protobuf::Command& input_command)
{
    using protobuf::Command;
    auto command = input_command;
    std::vector<Command> command_fragments;
    int goal_max_size = 14;
    int fragment_index = 0;
    int goal_index = 0;

    glog.is_debug1() && glog << group("main")
                             << "Received Full Command: " << input_command.ShortDebugString()
                             << std::endl;

    if (command.type() == Command::MISSION_PLAN && command.plan().goal_size() > goal_max_size)
    {
        double command_fragments_expected =
            std::ceil((double)command.plan().goal_size() / (double)goal_max_size);

        glog.is_debug1() &&
            glog << group("main") << "Expected: " << command_fragments_expected
                 << ", Size: " << command.plan().goal_size() << ", Max Size: " << goal_max_size
                 << ", Calc: " << (command.plan().goal_size() / goal_max_size) << std::endl;

        for (fragment_index = 0; fragment_index < command_fragments_expected; fragment_index++)
        {
            glog.is_debug1() && glog << group("main") << "Fragment: " << fragment_index
                                     << ", Fragment Expected: " << command_fragments_expected
                                     << std::endl;
            Command command_fragment;
            command_fragment.set_bot_id(command.bot_id());
            command_fragment.set_time(command.time());
            command_fragment.set_type(Command::MISSION_PLAN_FRAGMENT);

            glog.is_debug1() && glog << group("main")
                                     << "Fragment: " << command_fragment.ShortDebugString()
                                     << std::endl;

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
                protobuf::MissionPlan_Recovery* recovery = new protobuf::MissionPlan_Recovery();
                recovery->ParseFromString(command.plan().recovery().SerializeAsString());
                command_fragment.mutable_plan()->set_allocated_recovery(recovery);
            }

            command_fragment.mutable_plan()->set_fragment_index((uint8_t)fragment_index);

            command_fragment.mutable_plan()->set_expected_fragments(
                (int)command_fragments_expected);

            goal_max_size = ((fragment_index + 1) * goal_max_size);

            glog.is_debug1() && glog << group("main") << "Goal max size: " << goal_max_size
                                     << ", fragment index: " << fragment_index
                                     << ", Total goal size: " << command.plan().goal_size()
                                     << std::endl;

            for (; goal_index < command.plan().goal_size(); goal_index++)
            {
                if (goal_index < goal_max_size)
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
                        protobuf::MissionTask* task = new protobuf::MissionTask();
                        task->ParseFromString(
                            command.plan().goal(goal_index).task().SerializeAsString());
                        goal->set_allocated_task(task);
                    }

                    protobuf::GeographicCoordinate* coord = new protobuf::GeographicCoordinate();
                    coord->ParseFromString(
                        command.plan().goal(goal_index).location().SerializeAsString());
                    goal->set_allocated_location(coord);
                }
                else
                {
                    break;
                }
            }
            goal_index = +goal_max_size;
            command_fragments.push_back(command_fragment);
        }
    }

    goby::middleware::Publisher<Command> command_publisher(
        {}, [](Command& cmd, const goby::middleware::Group& group) {
            cmd.set_bot_id(group.numeric());
        });

    if (!command_fragments.empty())
    {
        for (const auto& command_fragment : command_fragments)
        {
            glog.is_debug2() && glog << group("main")
                                     << "Sending command: " << command_fragment.ShortDebugString()
                                     << std::endl;

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

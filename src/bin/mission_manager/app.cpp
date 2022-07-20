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

#include "machine.h"
#include "mission_manager.h"

#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/pressure_temperature.pb.h"
#include "jaiabot/messages/salinity.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
namespace groups
{
std::unique_ptr<goby::middleware::DynamicGroup> hub_command_this_bot;
}

class MissionManagerConfigurator
    : public goby::middleware::ProtobufConfigurator<config::MissionManager>
{
  public:
    MissionManagerConfigurator(int argc, char* argv[])
        : goby::middleware::ProtobufConfigurator<config::MissionManager>(argc, argv)
    {
        const auto& cfg = mutable_cfg();

        // create a specific dynamic group for this bot's ID so we only subscribe to our own commands
        groups::hub_command_this_bot.reset(
            new goby::middleware::DynamicGroup(jaiabot::groups::hub_command, cfg.bot_id()));
    }
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::MissionManager>(
        jaiabot::apps::MissionManagerConfigurator(argc, argv));
}

// Main thread
void jaiabot::apps::MissionManager::initialize()
{
    machine_.reset(new statechart::MissionManagerStateMachine(*this));
    machine_->initiate();

    machine_->process_event(statechart::EvTurnOn());

    // TODO: remove placeholder when actual subscriptions are added
    handle_self_test_results(true);
}

void jaiabot::apps::MissionManager::finalize()
{
    machine_->terminate();
    machine_.reset();
}

jaiabot::apps::MissionManager::MissionManager()
    : zeromq::MultiThreadApplication<config::MissionManager>(1 * si::hertz)
{
    glog.add_group("statechart", goby::util::Colors::yellow);
    glog.add_group("movement", goby::util::Colors::lt_green);
    glog.add_group("task", goby::util::Colors::lt_blue);

    interthread().subscribe<jaiabot::groups::state_change>(
        [this](const std::pair<bool, jaiabot::protobuf::MissionState>& state_pair) {
            const auto& state_name = jaiabot::protobuf::MissionState_Name(state_pair.second);

            if (state_pair.first)
                glog.is_verbose() && glog << group("statechart") << "Entered: " << state_name
                                          << std::endl;
            else
                glog.is_verbose() && glog << group("statechart") << "Exited: " << state_name
                                          << std::endl;
        });

    // subscribe for commands
    {
        auto on_command_subscribed =
            [this](const goby::middleware::intervehicle::protobuf::Subscription& sub,
                   const goby::middleware::intervehicle::protobuf::AckData& ack) {
                glog.is_debug1() && glog << "Received acknowledgment:\n\t" << ack.ShortDebugString()
                                         << "\nfor subscription:\n\t" << sub.ShortDebugString()
                                         << std::endl;
            };

        // use vehicle ID as group for command
        auto do_set_group = [](const protobuf::Command& command) -> goby::middleware::Group {
            return goby::middleware::Group(command.bot_id());
        };

        goby::middleware::Subscriber<protobuf::Command> command_subscriber{
            cfg().command_sub_cfg(), do_set_group, on_command_subscribed};

        intervehicle().subscribe_dynamic<protobuf::Command>(
            [this](const protobuf::Command& command) {
                handle_command(command);
                // republish for logging purposes
                interprocess().publish<jaiabot::groups::hub_command>(command);
            },
            *groups::hub_command_this_bot, command_subscriber);
    }

    // subscribe for pHelmIvP desired course
    interprocess().subscribe<goby::middleware::frontseat::groups::desired_course>(
        [this](const goby::middleware::frontseat::protobuf::DesiredCourse& desired_setpoints) {
            glog.is_verbose() && glog << "Received DesiredCourse: "
                                      << desired_setpoints.ShortDebugString() << std::endl;
            glog.is_verbose() && glog << "Relaying flag: "
                                      << (machine_->setpoint_type() == protobuf::SETPOINT_IVP_HELM)
                                      << std::endl;
            if (machine_->setpoint_type() == protobuf::SETPOINT_IVP_HELM)
            {
                protobuf::DesiredSetpoints setpoint_msg;
                setpoint_msg.set_type(protobuf::SETPOINT_IVP_HELM);
                *setpoint_msg.mutable_helm_course() = desired_setpoints;
                glog.is_verbose() && glog << "Relaying desired_setpoints: "
                                          << setpoint_msg.ShortDebugString() << std::endl;
                interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
            }
        });

    // subscribe for reports from the pHelmIvP behaviors
    interprocess().subscribe<jaiabot::groups::mission_ivp_behavior_report>(
        [this](const protobuf::IvPBehaviorReport& report) {
            glog.is_debug1() && glog << "IvPBehaviorReport: " << report.ShortDebugString()
                                     << std::endl;

            switch (report.behavior_case())
            {
                case protobuf::IvPBehaviorReport::kTransit:
                    if (report.transit().waypoint_reached())
                    {
                        glog.is_debug1() && glog << "Posting EvWaypointReached" << std::endl;
                        machine_->process_event(statechart::EvWaypointReached());
                    }

                    break;

                case protobuf::IvPBehaviorReport::BEHAVIOR_NOT_SET: break;
            }
        });

    // subscribe for vehicle depth (from NodeStatus)
    interprocess().subscribe<goby::middleware::frontseat::groups::node_status>(
        [this](const goby::middleware::frontseat::protobuf::NodeStatus& node_status) {
            machine_->process_event(
                statechart::EvVehicleDepth(node_status.global_fix().depth_with_units()));
        });

    // subscribe for sensor measurements
    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const jaiabot::protobuf::PressureTemperatureData& pt) {
            statechart::EvMeasurement ev;
            ev.temperature = pt.temperature_with_units();
            machine_->process_event(ev);
        });

    // subscribe for salinity data
    interprocess().subscribe<jaiabot::groups::salinity>(
        [this](const jaiabot::protobuf::SalinityData& sal) {
            statechart::EvMeasurement ev;
            ev.salinity = sal.salinity();
            machine_->process_event(ev);
        });
}

jaiabot::apps::MissionManager::~MissionManager()
{
    // unsubscribe for commands
    {
        auto on_command_unsubscribed =
            [this](const goby::middleware::intervehicle::protobuf::Subscription& sub,
                   const goby::middleware::intervehicle::protobuf::AckData& ack) {
                glog.is_debug1() && glog << "Received acknowledgment:\n\t" << ack.ShortDebugString()
                                         << "\nfor subscription:\n\t" << sub.ShortDebugString()
                                         << std::endl;
            };
        goby::middleware::Subscriber<protobuf::Command> command_subscriber{cfg().command_sub_cfg(),
                                                                           on_command_unsubscribed};

        intervehicle().unsubscribe_dynamic<protobuf::Command>(*groups::hub_command_this_bot,
                                                              command_subscriber);
    }
}

void jaiabot::apps::MissionManager::loop()
{
    protobuf::MissionReport report;
    report.set_state(machine_->state());

    const auto* in_mission = machine_->state_cast<const statechart::InMission*>();

    // only report the goal index when not in recovery
    if (in_mission && in_mission->goal_index() != statechart::InMission::RECOVERY_GOAL_INDEX)
        report.set_active_goal(in_mission->goal_index());

    interprocess().publish<jaiabot::groups::mission_report>(report);

    machine_->process_event(statechart::EvLoop());
}

void jaiabot::apps::MissionManager::handle_command(const protobuf::Command& command)
{
    glog.is_debug1() && glog << "Received command: " << command.ShortDebugString() << std::endl;

    switch (command.type())
    {
        case protobuf::Command::MISSION_PLAN:
        {
            machine_->process_event(statechart::EvNewMission());

            bool mission_is_feasible = true;

            // must have at least one goal
            if (command.plan().movement() == protobuf::MissionPlan::TRANSIT &&
                command.plan().goal_size() == 0)
            {
                glog.is_warn() && glog << "Infeasible mission: Must have at least one goal in "
                                          "a TRANSIT mission"
                                       << std::endl;
                mission_is_feasible = false;
            }

            // cannot recover at final goal if there isn't one
            if (command.plan().recovery().recover_at_final_goal() &&
                command.plan().goal_size() == 0)
            {
                glog.is_warn() && glog << "Infeasible mission: Must have at least one goal to have "
                                          "recover_at_final_goal: true"
                                       << std::endl;
                mission_is_feasible = false;
            }

            // must have a location if !recover_at_final_goal
            if (!command.plan().recovery().recover_at_final_goal() &&
                !command.plan().recovery().has_location())
            {
                glog.is_warn() && glog << "Infeasible mission: Must have recovery location if not "
                                          "recovering at final goal"
                                       << std::endl;
                mission_is_feasible = false;
            }

            if (mission_is_feasible)
            {
                // pass mission plan through event so that the mission plan in MissionManagerStateMachine only gets updated if this event is handled
                machine_->process_event(statechart::EvMissionFeasible(command.plan()));
            }
            else
            {
                machine_->process_event(statechart::EvMissionInfeasible());
            }
        }
        break;

        case protobuf::Command::START_MISSION:
            machine_->process_event(statechart::EvDeployed());
            break;

        case protobuf::Command::NEXT_TASK:
            machine_->process_event(statechart::EvTaskComplete());
            break;

        case protobuf::Command::RETURN_TO_HOME:
            machine_->process_event(statechart::EvReturnToHome());
            break;
        case protobuf::Command::STOP: machine_->process_event(statechart::EvStop()); break;
        case protobuf::Command::REDEPLOY: machine_->process_event(statechart::EvRedeploy()); break;
        case protobuf::Command::SHUTDOWN: machine_->process_event(statechart::EvShutdown()); break;

        case protobuf::Command::REMOTE_CONTROL_SETPOINT:
            machine_->process_event(statechart::EvRCSetpoint(command.rc()));
            break;

        case protobuf::Command::REMOTE_CONTROL_TASK:
            machine_->process_event(statechart::EvPerformTask(command.rc_task()));
            break;

        case protobuf::Command::REMOTE_CONTROL_RESUME_MOVEMENT:
            machine_->process_event(statechart::EvResumeMovement());
            break;

            // handled by jaiabot_health
        case protobuf::Command::REBOOT_COMPUTER:
        case protobuf::Command::RESTART_ALL_SERVICES: break;
    }
}

void jaiabot::apps::MissionManager::handle_self_test_results(bool result)
{
    if (result)
        machine_->process_event(statechart::EvSelfTestSuccessful());
    else
        machine_->process_event(statechart::EvSelfTestFails());
}

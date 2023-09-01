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

#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/util/seawater.h>

#include "machine.h"
#include "mission_manager.h"

#include "jaiabot/comms/comms.h"
#include "jaiabot/health/health.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/pressure_temperature.pb.h"
#include "jaiabot/messages/salinity.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

#define earthRadiusKm 6371.0

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
        auto& cfg = mutable_cfg();

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

    use_goal_timeout_ = cfg().use_goal_timeout();

    // Create a set of states. when the bot is in
    // one of these modes we should detect goal timeout
    for (auto gs : cfg().include_goal_timeout_states())
    {
        auto gts = static_cast<jaiabot::protobuf::MissionState>(gs);
        include_goal_timeout_states_.insert(gts);
    }

    for (auto m : cfg().test_mode())
    {
        auto em = static_cast<jaiabot::config::MissionManager::EngineeringTestMode>(m);
        if (em == config::MissionManager::ENGINEERING_TEST__INDOOR_MODE__NO_GPS)
        {
            glog.is_debug1() &&
                glog << "ENGINEERING_TEST__INDOOR_MODE__NO_GPS also sets "
                        "ENGINEERING_TEST__IGNORE_SOME_ERRORS with ignore_error: "
                        "[ERROR__MISSING_DATA__GPS_FIX, ERROR__MISSING_DATA__GPS_POSITION, "
                        "ERROR__MISSING_DATA__HEADING, ERROR__MISSING_DATA__SPEED, "
                        "ERROR__MISSING_DATA__COURSE]"
                     << std::endl;
            test_modes_.insert(config::MissionManager::ENGINEERING_TEST__IGNORE_SOME_ERRORS);
            ignore_errors_.insert(protobuf::ERROR__MISSING_DATA__GPS_FIX);
            ignore_errors_.insert(protobuf::ERROR__MISSING_DATA__GPS_POSITION);
            ignore_errors_.insert(protobuf::ERROR__MISSING_DATA__HEADING);
            ignore_errors_.insert(protobuf::ERROR__MISSING_DATA__SPEED);
            ignore_errors_.insert(protobuf::ERROR__MISSING_DATA__COURSE);
        }
        test_modes_.insert(em);
    }

    for (auto e : cfg().ignore_error()) ignore_errors_.insert(static_cast<protobuf::Error>(e));

    interthread().subscribe<jaiabot::groups::state_change>(
        [this](const std::pair<bool, jaiabot::protobuf::MissionState>& state_pair) {
            const auto& state_name = jaiabot::protobuf::MissionState_Name(state_pair.second);

            if (state_pair.first)
            {
                glog.is_verbose() && glog << group("statechart") << "Entered: " << state_name
                                          << std::endl;
            }
            else
                glog.is_verbose() && glog << group("statechart") << "Exited: " << state_name
                                          << std::endl;
        });

    if (cfg().has_subscribe_to_hub_on_start())
    {
        intervehicle_subscribe(cfg().subscribe_to_hub_on_start());
    }

    // subscribe for commands when we get a request to subscribe (hub info changed)
    interprocess().subscribe<jaiabot::groups::intervehicle_subscribe_request>(
        [this](const jaiabot::protobuf::HubInfo& hub_info) { intervehicle_subscribe(hub_info); });

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

    // subscribe for latitude (from NodeStatus)
    interprocess().subscribe<goby::middleware::frontseat::groups::node_status>(
        [this](const goby::middleware::frontseat::protobuf::NodeStatus& node_status) {
            latest_lat_ = node_status.global_fix().lat_with_units();
            machine_->set_latest_lat(latest_lat_);
        });

    // subscribe for sensor measurements (including pressure -> depth)
    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const jaiabot::protobuf::PressureTemperatureData& pt) {
            machine_->calculate_pressure_adjusted(pt);

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

    // subscribe for health data
    interprocess().subscribe<goby::middleware::groups::health_report>(
        [this](const goby::middleware::protobuf::VehicleHealth& vehicle_health) {
            if (health_considered_ok(vehicle_health))
            {
                // consider the system started when it reports a non-failed health report (as at least all the expected apps have responded)
                machine_->process_event(statechart::EvStarted());

                // TODO make SelfTest include more information?
                machine_->process_event(statechart::EvSelfTestSuccessful());
            }
            else
            {
                machine_->process_event(statechart::EvSelfTestFails());
            }
        });

    // subscribe for GPS data (to reacquire after resurfacing)
    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            current_tpv_ = tpv;

            // TODO make sure this meets gps requirements
            machine_->set_gps_tpv(current_tpv_);
        });

    // subscribe for GPS data (to reacquire gps)
    interprocess().subscribe<goby::middleware::groups::gpsd::sky>(
        [this](const goby::middleware::protobuf::gpsd::SkyView& sky) {
            glog.is_debug2() && glog << "Received GPS HDOP: " << sky.hdop()
                                     << ", PDOP: " << sky.pdop() << std::endl;

            if (sky.has_hdop() && sky.has_pdop())
            {
                statechart::EvVehicleGPS ev;
                ev.hdop = sky.hdop();
                ev.pdop = sky.pdop();
                machine_->process_event(ev);

                // Publish TPV that meets our mission requirements
                if (current_tpv_.IsInitialized())
                {
                    machine_->set_gps_tpv(current_tpv_);
                }
            }
        });

    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const jaiabot::protobuf::IMUData& imu_data) {
            glog.is_debug2() && glog << "Received IMU Data " << imu_data.ShortDebugString()
                                     << std::endl;

            if (imu_data.has_euler_angles())
            {
                if (imu_data.euler_angles().has_pitch())
                {
                    statechart::EvVehiclePitch ev;
                    ev.pitch = imu_data.euler_angles().pitch_with_units();
                    machine_->process_event(ev);
                }
            }
        });

    interprocess().subscribe<jaiabot::groups::imu>(
        [this](const jaiabot::protobuf::IMUIssue& imu_issue) {
            glog.is_debug2() && glog << "Received IMU Issue " << imu_issue.ShortDebugString()
                                     << std::endl;

            switch (imu_issue.solution())
            {
                case protobuf::IMUIssue::STOP_BOT:
                    machine_->process_event(statechart::EvStop());
                    break;
                case protobuf::IMUIssue::RESTART_IMU_PY:
                    machine_->process_event(statechart::EvIMURestart());
                    break;
                case protobuf::IMUIssue::REBOOT_BOT: break;
                case protobuf::IMUIssue::USE_COG: break;
                case protobuf::IMUIssue::USE_CORRECTION: break;
                case protobuf::IMUIssue::REPORT_IMU: break;
                case protobuf::IMUIssue::RESTART_BOT: break;
                default:
                    //TODO Handle Default Case
                    break;
            }
        });

    // Subscribe to IMU data for max_acceleration, for bottom characterization
    interprocess().subscribe<jaiabot::groups::imu>([this](
                                                       const jaiabot::protobuf::IMUData& imu_data) {
        glog.is_debug2() && glog << "Received IMUData " << imu_data.ShortDebugString() << std::endl;

        machine_->set_latest_max_acceleration(imu_data.max_acceleration_with_units());
        machine_->set_latest_significant_wave_height(imu_data.significant_wave_height());
    });

    // subscribe for engineering commands
    interprocess().subscribe<jaiabot::groups::engineering_command>(
        [this](const jaiabot::protobuf::Engineering& command) {
            glog.is_debug1() && glog << "=> " << command.ShortDebugString() << std::endl;

            if (command.has_gps_requirements())
            {
                if (command.gps_requirements().has_transit_hdop_req())
                {
                    machine_->set_transit_hdop_req(command.gps_requirements().transit_hdop_req());
                }
                if (command.gps_requirements().has_transit_pdop_req())
                {
                    machine_->set_transit_pdop_req(command.gps_requirements().transit_pdop_req());
                }
                if (command.gps_requirements().has_after_dive_hdop_req())
                {
                    machine_->set_after_dive_hdop_req(
                        command.gps_requirements().after_dive_hdop_req());
                }
                if (command.gps_requirements().has_after_dive_pdop_req())
                {
                    machine_->set_after_dive_pdop_req(
                        command.gps_requirements().after_dive_pdop_req());
                }
                if (command.gps_requirements().has_transit_gps_fix_checks())
                {
                    machine_->set_transit_gps_fix_checks(
                        command.gps_requirements().transit_gps_fix_checks());
                }
                if (command.gps_requirements().has_transit_gps_degraded_fix_checks())
                {
                    machine_->set_transit_gps_degraded_fix_checks(
                        command.gps_requirements().transit_gps_degraded_fix_checks());
                }
                if (command.gps_requirements().has_after_dive_gps_fix_checks())
                {
                    machine_->set_after_dive_gps_fix_checks(
                        command.gps_requirements().after_dive_gps_fix_checks());
                }
            }
            if (command.has_bottom_depth_safety_params())
            {
                if (command.bottom_depth_safety_params().has_constant_heading())
                {
                    machine_->set_bottom_depth_safety_constant_heading(
                        command.bottom_depth_safety_params().constant_heading());
                }
                if (command.bottom_depth_safety_params().has_constant_heading_speed())
                {
                    machine_->set_bottom_depth_safety_constant_heading_speed(
                        command.bottom_depth_safety_params().constant_heading_speed());
                }
                if (command.bottom_depth_safety_params().has_constant_heading_time())
                {
                    machine_->set_bottom_depth_safety_constant_heading_time(
                        command.bottom_depth_safety_params().constant_heading_time());
                }
                if (command.bottom_depth_safety_params().has_safety_depth())
                {
                    machine_->set_bottom_safety_depth(
                        command.bottom_depth_safety_params().safety_depth());
                }
            }

            // Publish only when we get a query for status
            if (command.query_engineering_status())
            {
                jaiabot::protobuf::Engineering engineering_status;
                jaiabot::protobuf::GPSRequirements gps_requirements;

                // Send engineering status for hdop and pdop current requirements
                engineering_status.set_bot_id(cfg().bot_id());

                // GPS Requirements
                gps_requirements.set_transit_hdop_req(machine_->transit_hdop_req());
                gps_requirements.set_transit_pdop_req(machine_->transit_pdop_req());
                gps_requirements.set_after_dive_hdop_req(machine_->after_dive_hdop_req());
                gps_requirements.set_after_dive_pdop_req(machine_->after_dive_pdop_req());
                gps_requirements.set_transit_gps_fix_checks(machine_->transit_gps_fix_checks());
                gps_requirements.set_transit_gps_degraded_fix_checks(
                    machine_->transit_gps_degraded_fix_checks());
                gps_requirements.set_after_dive_gps_fix_checks(
                    machine_->after_dive_gps_fix_checks());

                *engineering_status.mutable_gps_requirements() = gps_requirements;

                engineering_status.mutable_bottom_depth_safety_params()->set_safety_depth(
                    machine_->bottom_safety_depth());
                engineering_status.mutable_bottom_depth_safety_params()->set_constant_heading(
                    machine_->bottom_depth_safety_constant_heading());
                engineering_status.mutable_bottom_depth_safety_params()->set_constant_heading_speed(
                    machine_->bottom_depth_safety_constant_heading_speed());
                engineering_status.mutable_bottom_depth_safety_params()->set_constant_heading_time(
                    machine_->bottom_depth_safety_constant_heading_time());

                interprocess().publish<jaiabot::groups::engineering_status>(engineering_status);
            }
        });

    // handle rf disable commands to make sure task packets are not sent
    interprocess().subscribe<jaiabot::groups::powerstate_command>(
        [this](const jaiabot::protobuf::Engineering& power_rf) {
            if (power_rf.has_rf_disable_options())
            {
                if (power_rf.rf_disable_options().has_rf_disable())
                {
                    if (power_rf.rf_disable_options().rf_disable())
                    {
                        machine_->set_rf_disable(true);
                    }
                    else
                    {
                        machine_->set_rf_disable(false);
                    }
                }
            }
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
        goby::middleware::Subscriber<protobuf::Command> command_subscriber{latest_command_sub_cfg_,
                                                                           on_command_unsubscribed};

        intervehicle().unsubscribe_dynamic<protobuf::Command>(*groups::hub_command_this_bot,
                                                              command_subscriber);
    }
}

void jaiabot::apps::MissionManager::intervehicle_subscribe(
    const jaiabot::protobuf::HubInfo& hub_info)
{
    // set environmental variable for dataoffload
    setenv("jaia_dataoffload_hub_id", std::to_string(hub_info.hub_id()).c_str(), 1 /*overwrite*/);

    // Update current hub id
    hub_id_ = hub_info.hub_id();

    glog.is_verbose() && glog << "Subscribing for Commands from hub " << hub_info.hub_id()
                              << " (modem id " << hub_info.modem_id() << ")" << std::endl;

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

    latest_command_sub_cfg_ = cfg().command_sub_cfg();

    // set command publisher to the hub that triggered this subscribe
    latest_command_sub_cfg_.mutable_intervehicle()->clear_publisher_id();
    latest_command_sub_cfg_.mutable_intervehicle()->add_publisher_id(hub_info.modem_id());

    goby::middleware::Subscriber<protobuf::Command> command_subscriber{
        latest_command_sub_cfg_, do_set_group, on_command_subscribed};

    intervehicle().subscribe_dynamic<protobuf::Command>(
        [this](const protobuf::Command& input_command) {
            if (input_command.type() == protobuf::Command::MISSION_PLAN_FRAGMENT)
            {
                protobuf::Command out_command;
                bool command_valid = handle_command_fragment(input_command, out_command);
                if (command_valid)
                {
                    handle_command(out_command);
                    // republish for logging purposes
                    interprocess().publish<jaiabot::groups::hub_command>(out_command);
                }
            }
            else
            {
                handle_command(input_command);
                // republish for logging purposes
                interprocess().publish<jaiabot::groups::hub_command>(input_command);
            }
        },
        *groups::hub_command_this_bot, command_subscriber);
}

void jaiabot::apps::MissionManager::loop()
{
    double goal_speed = 0;
    auto current_time = goby::time::SteadyClock::now();
    protobuf::MissionReport report;
    report.set_state(machine_->state());

    const auto* in_mission = machine_->state_cast<const statechart::InMission*>();
    const auto* data_offload =
        machine_->state_cast<const statechart::postdeployment::DataOffload*>();

    if (data_offload)
    {
        report.set_data_offload_percentage(data_offload->data_offload_percentage());
    }

    // only report the goal index when not in recovery
    if (in_mission && in_mission->goal_index() != statechart::InMission::RECOVERY_GOAL_INDEX)
    {
        // Set Active Goal Index + 1 for User Interface And Log Review.
        report.set_active_goal(in_mission->goal_index() + 1);

        if (in_mission->current_goal().has_value())
        {
            if (in_mission->current_goal()->has_location())
            {
                *report.mutable_active_goal_location() = in_mission->current_goal()->location();
            }
        }
        goal_speed = machine_->mission_plan().speeds().transit();
    }
    else if (in_mission && in_mission->goal_index() == statechart::InMission::RECOVERY_GOAL_INDEX)
    {
        if (machine_->mission_plan().recovery().has_recover_at_final_goal())
        {
            if (machine_->mission_plan().recovery().recover_at_final_goal())
            {
                *report.mutable_active_goal_location() =
                    machine_->mission_plan()
                        .goal()
                        .Get(machine_->mission_plan().goal_size() - 1)
                        .location();
            }
        }
        else if (machine_->mission_plan().recovery().has_location())
        {
            *report.mutable_active_goal_location() = machine_->mission_plan().recovery().location();
        }

        goal_speed = machine_->mission_plan().speeds().stationkeep_outer();
    }

    if (current_tpv_.has_location() && report.has_active_goal_location())
    {
        // Check for an updated goal
        if (current_goal_ != report.active_goal())
        {
            glog.is_debug2() && glog << "current goal does not equal active:" << std::endl;
            current_goal_ = report.active_goal();

            // Clear current_goal_dist_history_ to start new with update goal
            std::queue<double> empty;
            std::swap(current_goal_dist_history_, empty);

            updated_goal_ = true;
            last_goal_timeout_time_ = current_time;
        }

        double distance =
            distanceToGoal(report.active_goal_location().lat(), report.active_goal_location().lon(),
                           current_tpv_.location().lat(), current_tpv_.location().lon());
        // Set distance in meters
        distance = distance * (1000);
        report.set_distance_to_active_goal(distance);

        // Check the queue size to ensure it is less than max
        if (current_goal_dist_history_.size() >= cfg().tpv_history_max())
        {
            //linear_regression();
            current_goal_dist_history_.pop();
        }
        current_goal_dist_history_.push(distance);

        // First pass at implementing goal timeout
        if (updated_goal_)
        {
            goal_timeout_ =
                (distance / goal_speed) * cfg().goal_timeout_buffer_factor() +
                (cfg().total_gps_fix_checks() * cfg().goal_timeout_reacquire_gps_attempts());

            glog.is_debug2() &&
                glog << "goal_timeout_: " << goal_timeout_ << " , distance: " << distance
                     << " , goal_speed: " << goal_speed
                     << " , goal_timeout_buffer_factor: " << cfg().goal_timeout_buffer_factor()
                     << " , total_gps_fix_checks: " << cfg().total_gps_fix_checks()
                     << " , goal_timeout_reacquire_gps_attempts: "
                     << cfg().goal_timeout_reacquire_gps_attempts() << std::endl;
            updated_goal_ = false;
        }

        // Check to see if operator wants to use goal timeout
        // And Check to see if we are in correct state to detect goal timeout
        if (use_goal_timeout_ && include_goal_timeout_states_.count(machine_->state()))
        {
            // Confirm goal_timeout_ is initialized
            if (goal_timeout_)
            {
                // If current time is greater than the timeout, then go to next wpt
                if ((last_goal_timeout_time_ + std::chrono::seconds(goal_timeout_)) <= current_time)
                {
                    glog.is_debug2() && glog << "Goal timedout" << std::endl;
                    machine_->process_event(statechart::EvWaypointReached());

                    // Check config to see if we should skip task
                    if (cfg().skip_goal_task())
                    {
                        machine_->process_event(statechart::EvTaskComplete());
                    }
                }
                else
                {
                    auto goal_timeout = std::chrono::duration_cast<std::chrono::seconds>(
                        (last_goal_timeout_time_ + std::chrono::seconds(goal_timeout_)) -
                        current_time);

                    glog.is_debug2() && glog << "Goal time out: " << goal_timeout.count()
                                             << std::endl;
                    report.set_active_goal_timeout(goal_timeout.count());
                }
            }
        }
        else
        {
            // Report 0 if no goal timeout
            report.set_active_goal_timeout(0);
        }
    }

    interprocess().publish<jaiabot::groups::mission_report>(report);

    // Check if we have a new hub
    if (hub_id_ != machine_->hub_id())
    {
        glog.is_debug1() && glog << "hub_id_: " << hub_id_
                                 << ", machine_->hub_id(): " << machine_->hub_id() << std::endl;
        machine_->set_hub_id(hub_id_);
    }

    machine_->process_event(statechart::EvLoop());
}

void jaiabot::apps::MissionManager::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    health.set_state(goby::middleware::protobuf::HEALTH__OK);
    // add warnings that the state machine keeps track of and possible downgrade health state
    machine_->health(health);
}

void jaiabot::apps::MissionManager::handle_command(const protobuf::Command& command)
{
    glog.is_debug1() && glog << "Received command: " << command.ShortDebugString() << std::endl;

    // Make sure the command has a newer timestamp
    // If it is not then we should not handle the command and exit
    if (prev_command_time_ >= command.time())
    {
        glog.is_warn() && glog << "Old command received! Ignoring..." << std::endl;

        // Exit handle command function if the previous
        // Command time is greater than the one current one
        return;
    }

    // Keep track of the previous command time
    prev_command_time_ = command.time();

    switch (command.type())
    {
        case protobuf::Command::MISSION_PLAN:
        {
            machine_->process_event(statechart::EvNewMission());

            bool mission_is_feasible = true;
            bool goal_depth_infeasible = false;

            // Make sure the mission plan does not include a dive
            // greater than allowed max
            for (auto goal : command.plan().goal())
            {
                if (goal.task().dive().max_depth() >
                    60) //protobuf::MissionTask::DiveParameters::descriptor()
                        //    ->FindFieldByName("max_depth")
                        //    ->options()
                        //    .GetExtension(dccl::field)
                        //    .max())
                {
                    goal_depth_infeasible = true;
                }
            }

            // must have at least one goal
            if (command.plan().movement() == protobuf::MissionPlan::TRANSIT &&
                command.plan().goal_size() == 0)
            {
                glog.is_warn() && glog << "Infeasible mission: Must have at least one goal in "
                                          "a TRANSIT mission"
                                       << std::endl;
                machine_->insert_warning(
                    jaiabot::protobuf::
                        WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_MUST_HAVE_A_GOAL);
                mission_is_feasible = false;
            }
            // cannot recover at final goal if there isn't one
            else if (command.plan().recovery().recover_at_final_goal() &&
                     command.plan().goal_size() == 0)
            {
                glog.is_warn() && glog << "Infeasible mission: Must have at least one goal to have "
                                          "recover_at_final_goal: true"
                                       << std::endl;
                machine_->insert_warning(
                    jaiabot::protobuf::
                        WARNING__MISSION__INFEASIBLE_MISSION__TRANSIT_CANNOT_RECOVER_AT_FINAL_GOAL_WITHOUT_A_GOAL);
                mission_is_feasible = false;
            }
            // must have a location if !recover_at_final_goal
            else if (!command.plan().recovery().recover_at_final_goal() &&
                     !command.plan().recovery().has_location())
            {
                glog.is_warn() && glog << "Infeasible mission: Must have recovery location if not "
                                          "recovering at final goal"
                                       << std::endl;
                machine_->insert_warning(
                    jaiabot::protobuf::
                        WARNING__MISSION__INFEASIBLE_MISSION__MUST_HAVE_RECOVERY_LOCATION_IF_NOT_RECOVERING_AT_FINAL_GOAL);

                mission_is_feasible = false;
            }
            else if (goal_depth_infeasible)
            {
                glog.is_warn() && glog << "Infeasible mission: Depth exceeds max depth"
                                       << std::endl;
                machine_->insert_warning(
                    jaiabot::protobuf::
                        WARNING__MISSION__INFEASIBLE_MISSION__GOAL_DESIRED_DEPTH_EXCEEDED_MAX);
                mission_is_feasible = false;
            }

            if (mission_is_feasible)
            {
                // pass mission plan through event so that the mission plan in MissionManagerStateMachine only gets updated if this event is handled
                machine_->process_event(statechart::EvMissionFeasible(command.plan()));
                // these are left over from the last mission command, erase them
                machine_->erase_infeasible_mission_warnings();
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
            // Comment wpt reached event out because
            // there is a bug here!! We need to investigate why
            // we skip multiple waypoints (Happens in field, not in sim)
            // machine_->process_event(statechart::EvWaypointReached());
            machine_->process_event(statechart::EvTaskComplete());
            break;

        case protobuf::Command::RETURN_TO_HOME:
            machine_->process_event(statechart::EvReturnToHome());
            break;
        case protobuf::Command::STOP: machine_->process_event(statechart::EvStop()); break;
        case protobuf::Command::RECOVERED:
            machine_->process_event(statechart::EvRecovered());
            break;
        case protobuf::Command::ACTIVATE: machine_->process_event(statechart::EvActivate()); break;
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

        case protobuf::Command::RETRY_DATA_OFFLOAD:
            machine_->process_event(statechart::EvRetryDataOffload());
            break;

            // handled by jaiabot_health
        case protobuf::Command::SHUTDOWN_COMPUTER:
        case protobuf::Command::REBOOT_COMPUTER:
            interprocess().publish<jaiabot::groups::powerstate_command>(command);
            break;
        case protobuf::Command::RESTART_ALL_SERVICES:
            interprocess().publish<jaiabot::groups::powerstate_command>(command);
            break;
    }
}

bool jaiabot::apps::MissionManager::handle_command_fragment(
    const protobuf::Command& input_command_fragment, protobuf::Command& out_command)
{
    // Index -> Command
    std::map<uint8_t, protobuf::Command> inner_map;
    glog.is_debug1() && glog << "Received command fragment: "
                             << input_command_fragment.ShortDebugString() << std::endl;

    // Time is used as the unique identifier
    if (track_command_fragments.count(input_command_fragment.time()))
    {
        glog.is_debug1() && glog << "Found fragment time: " << std::endl;
        if (track_command_fragments.at(input_command_fragment.time())
                .count(input_command_fragment.plan().fragment_index()))
        {
            // All set, already have the data
            glog.is_debug1() && glog << "Already have fragment index: " << std::endl;
        }
        else
        {
            // Add the fragment
            track_command_fragments[input_command_fragment.time()]
                                   [input_command_fragment.plan().fragment_index()] =
                                       input_command_fragment;

            glog.is_debug1() && glog << "Add fragment index: " << std::endl;
        }
    }
    else
    {
        glog.is_debug1() && glog << "New fragment time, clear map and add fragment: " << std::endl;
        //Let's only track one multi-message
        track_command_fragments.clear();
        inner_map.insert(
            std::make_pair(input_command_fragment.plan().fragment_index(), input_command_fragment));
        track_command_fragments.insert(std::make_pair(input_command_fragment.time(), inner_map));
    }

    glog.is_debug1() && glog << "track_command_fragments.at(input_command_fragment.time()).size(): "
                             << track_command_fragments.at(input_command_fragment.time()).size()
                             << ", Expected Fragments: "
                             << input_command_fragment.plan().expected_fragments() << std::endl;

    // We have reached the expected
    // Put the command together
    if (track_command_fragments.at(input_command_fragment.time()).size() ==
        input_command_fragment.plan().expected_fragments())
    {
        // Verify index 0 is in map
        if (track_command_fragments.at(input_command_fragment.time()).count(0))
        {
            //Initial fragment has mission details
            protobuf::Command initial_fragment =
                track_command_fragments.at(input_command_fragment.time()).at(0);

            out_command.set_bot_id(initial_fragment.bot_id());
            out_command.set_time(initial_fragment.time());
            out_command.set_type(protobuf::Command::MISSION_PLAN);

            if (initial_fragment.plan().has_start())
            {
                out_command.mutable_plan()->set_start(initial_fragment.plan().start());
            }

            if (initial_fragment.plan().has_movement())
            {
                out_command.mutable_plan()->set_movement(initial_fragment.plan().movement());
            }

            if (initial_fragment.plan().has_recovery())
            {
                *out_command.mutable_plan()->mutable_recovery() =
                    initial_fragment.plan().recovery();
            }

            if (initial_fragment.plan().has_repeats())
            {
                out_command.mutable_plan()->set_repeats(initial_fragment.plan().repeats());
            }

            // Loop through fragments and all the waypoints in each
            for (const auto fragment : track_command_fragments.at(input_command_fragment.time()))
            {
                for (int goal_index = 0; goal_index < fragment.second.plan().goal_size();
                     goal_index++)
                {
                    protobuf::MissionPlan::Goal* goal = out_command.mutable_plan()->add_goal();
                    if (fragment.second.plan().goal(goal_index).has_name())
                    {
                        goal->set_name(fragment.second.plan().goal(goal_index).name());
                    }
                    if (fragment.second.plan().goal(goal_index).has_task())
                    {
                        *goal->mutable_task() = fragment.second.plan().goal(goal_index).task();
                    }
                    *goal->mutable_location() = fragment.second.plan().goal(goal_index).location();
                }
                glog.is_debug2() && glog << "fragment: " << fragment.second.DebugString()
                                         << std::endl;
            }
            return true;
        }
        return false;
    }
    return false;
}

bool jaiabot::apps::MissionManager::health_considered_ok(
    const goby::middleware::protobuf::VehicleHealth& vehicle_health)
{
    if (vehicle_health.state() != goby::middleware::protobuf::HEALTH__FAILED)
    {
        return true;
    }
    else if (is_test_mode(config::MissionManager::ENGINEERING_TEST__IGNORE_SOME_ERRORS))
    {
        jaiabot::protobuf::BotStatus status;
        // check if we would be OK if the ignored errors didn't exist
        jaiabot::health::populate_status_from_health(status, vehicle_health, false);

        for (auto e : status.error())
        {
            // if we find any errors that are not excluded, health is not OK
            auto ee = static_cast<protobuf::Error>(e);
            if (!ignore_errors_.count(ee))
            {
                glog.is_debug1() && glog << "Error " << protobuf::Error_Name(ee)
                                         << " was not excluded" << std::endl;
                return false;
            }
        }
        // no errors found that were not excluded, so health is considered OK
        return true;
    }
    return false;
}

// This function converts decimal degrees to radians
double jaiabot::apps::MissionManager::deg2rad(const double& deg) { return (deg * M_PI / 180); }

/**
 * Returns the distance between two points on the Earth.
 * Direct translation from http://en.wikipedia.org/wiki/Haversine_formula
 * @param lat1d Latitude of the first point in degrees
 * @param lon1d Longitude of the first point in degrees
 * @param lat2d Latitude of the second point in degrees
 * @param lon2d Longitude of the second point in degrees
 * @return The distance between the two points in kilometers
 */
double jaiabot::apps::MissionManager::distanceToGoal(const double& lat1d, const double& lon1d,
                                                     const double& lat2d, const double& lon2d)
{
    double lat1r, lon1r, lat2r, lon2r, u, v;
    lat1r = deg2rad(lat1d);
    lon1r = deg2rad(lon1d);
    lat2r = deg2rad(lat2d);
    lon2r = deg2rad(lon2d);
    u = sin((lat2r - lat1r) / 2);
    v = sin((lon2r - lon1r) / 2);
    return 2.0 * earthRadiusKm * asin(sqrt(u * u + cos(lat1r) * cos(lat2r) * v * v));
}

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

#include "app.h"

#include "jaiabot/messages/jaia_dccl.pb.h"
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include "goby/util/sci.h"                                // for linear_interpolate

#define NOW (goby::time::SystemClock::now<goby::time::MicroTime>())

float THROTTLE_FOR_ZERO_NET_BUOYANCY = -35.0; // throttle that equalizes the buoyancy force of bot

using namespace std;
using goby::glog;
namespace si = boost::units::si;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

bool led_switch_on = true;

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::BotPidControl>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::BotPidControl>(argc, argv));
}

jaiabot::apps::BotPidControl::BotPidControl()
    : zeromq::MultiThreadApplication<config::BotPidControl>(10 * si::hertz)
{
    auto app_config = cfg();

    // Setup our bounds configuration
    if (app_config.has_bounds())
    {
        bounds = app_config.bounds();
    }

    if (bounds.motor().has_throttle_zero_net_buoyancy())
    {
        THROTTLE_FOR_ZERO_NET_BUOYANCY = bounds.motor().throttle_zero_net_buoyancy();
    }

    glog.is_verbose() && glog << "BotPidControl starting" << std::endl;
    glog.is_verbose() && glog << "Config: " << app_config.ShortDebugString() << std::endl;

    // Setup speed => throttle table
    if (app_config.has_use_throttle_table_for_speed())
    {
        use_throttle_table_for_speed = app_config.use_throttle_table_for_speed();
    }

    if (use_throttle_table_for_speed)
    {
        if (app_config.throttle_table_size() < 2)
            glog.is_die() &&
                glog << "Must define at least two entries in the 'throttle_table' when "
                        "using 'use_throttle_table_for_speed == true'"
                     << std::endl;

        for (const auto& entry : app_config.throttle_table())
            speed_to_throttle_.insert(std::make_pair(entry.speed(), entry.throttle()));
    }

    full_speed_window = app_config.full_speed_window();
    glog.is_warn() && glog << "full_speed_window = " << full_speed_window << endl;

    // Create our PID objects
    if (cfg().has_throttle_speed_pid_gains())
    {
        auto& gains = cfg().throttle_speed_pid_gains();
        throttle_speed_pid =
            new Pid(&actual_speed, &throttle, &processed_target_speed, gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        throttle_speed_pid = new Pid(&actual_speed, &throttle, &processed_target_speed, 20, 10, 0);
    }
    throttle_speed_pid->set_limits(0.0, 100.0);
    throttle_speed_pid->set_auto();

    /**
     * @brief Negative PIDs for throttle_depth_pid (Input positive, output negative)
     * 
     */
    if (cfg().has_throttle_depth_pid_gains())
    {
        auto& gains = cfg().throttle_depth_pid_gains();
        throttle_depth_pid =
            new Pid(&actual_depth, &throttle, &target_depth, gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        throttle_depth_pid = new Pid(&actual_depth, &throttle, &target_depth, 4, 1, 2);
    }
    throttle_depth_pid->set_auto();
    throttle_depth_pid->set_direction(E_PID_REVERSE);
    throttle_depth_pid->set_limits(-100.0, -THROTTLE_FOR_ZERO_NET_BUOYANCY);

    if (cfg().has_heading_pid_gains())
    {
        auto& gains = cfg().heading_pid_gains();
        heading_pid =
            new Pid(&actual_heading, &rudder, &target_heading, gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        heading_pid = new Pid(&actual_heading, &rudder, &target_heading, 0.7, 0.005, 0.2);
    }
    heading_pid->set_limits(-100.0, 100.0);
    heading_pid->set_auto();

    if (cfg().has_roll_pid_gains())
    {
        auto& gains = cfg().roll_pid_gains();
        roll_pid = new Pid(&actual_roll, &elevator_delta, &target_roll, gains.kp(), gains.ki(),
                           gains.kd());
    }
    else
    {
        roll_pid = new Pid(&actual_roll, &elevator_delta, &target_roll, 1, 0.5, 0);
    }
    roll_pid->set_limits(-100.0, 100.0);
    roll_pid->set_auto();

    if (cfg().has_pitch_pid_gains())
    {
        auto& gains = cfg().pitch_pid_gains();
        pitch_pid = new Pid(&actual_pitch, &elevator_middle, &target_pitch, gains.kp(), gains.ki(),
                            gains.kd());
    }
    else
    {
        pitch_pid = new Pid(&actual_pitch, &elevator_middle, &target_pitch, 1, 0.5, 0);
    }
    pitch_pid->set_limits(-100.0, 100.0);
    pitch_pid->set_auto();

    // subscribe for commands from engineering
    interprocess().subscribe<jaiabot::groups::engineering_command, jaiabot::protobuf::Engineering>(
        [this](const jaiabot::protobuf::Engineering& command) {
            if (command.has_pid_control()) {
                handle_engineering_command(command.pid_control());
            }

            // Publish only when we get a query for status
            if (command.query_engineering_status())
            {
                publish_engineering_status();
            }
        });

    // subscribe for commands from mission manager
    interprocess()
        .subscribe<jaiabot::groups::desired_setpoints, jaiabot::protobuf::DesiredSetpoints>(
            [this](const jaiabot::protobuf::DesiredSetpoints& command) {
                handle_command(command);
            });

    // Subscribe to get vehicle movement and orientation, for PID targeting
    interprocess().subscribe<goby::middleware::frontseat::groups::node_status>(
        [this](const goby::middleware::frontseat::protobuf::NodeStatus& node_status) {
            glog.is_debug2() && glog << "Received node status: " << node_status.ShortDebugString()
                                     << std::endl;

            if (node_status.has_pose())
            {
                auto attitude = node_status.pose();

                if (attitude.has_heading())
                {
                    actual_heading = attitude.heading();
                }

                if (attitude.has_roll())
                {
                    actual_roll = attitude.roll();
                }

                if (attitude.has_pitch())
                {
                    actual_pitch = attitude.pitch();
                }
            }

            if (node_status.has_speed())
            {
                auto speed = node_status.speed();

                if (speed.has_over_ground())
                {
                    actual_speed = speed.over_ground();
                }
            }

            if (node_status.has_global_fix() && node_status.global_fix().has_depth())
            {
                actual_depth = node_status.global_fix().depth();
            }

            glog.is_debug2() && glog << "Actual speed: " << actual_speed
                                     << " heading: " << actual_heading << " depth: " << actual_depth
                                     << std::endl;
        });
}

void jaiabot::apps::BotPidControl::loop()
{
    glog.is_debug3() && glog << throttle_speed_pid->description() << endl;
    glog.is_debug3() && glog << throttle_depth_pid->description() << endl;
    glog.is_debug3() && glog << heading_pid->description() << endl;
    glog.is_debug3() && glog << roll_pid->description() << endl;
    glog.is_debug3() && glog << pitch_pid->description() << endl;

    // Speed PID
    switch (_throttleMode)
    {
        case MANUAL: break;
        case PID_SPEED:

            {
                // Make processed_target_speed proportional to the dot product between our heading and desired heading, with a minimum value to orient ourselves
                float speed_multiplier = 1.0;

                if (_rudder_is_using_pid && actual_heading > -1000.0) {
                    // Apply a step function to the speed:
                    //  * 100% of desired speed when we are with n degrees
                    //  * Desired speed times dot product of heading error otherwise
                    float heading_error_deg = actual_heading - target_heading;
                    if (abs(heading_error_deg) < full_speed_window)
                    {
                        speed_multiplier = 1.0;
                    }
                    else
                    {
                        speed_multiplier = cos(heading_error_deg * M_PI / 180.0);
                    }
                }
                else {
                    speed_multiplier = 1.0;
                }
                processed_target_speed = target_speed * speed_multiplier;
                
                if (processed_target_speed != 0.0) {
                    processed_target_speed = max(0.5f, processed_target_speed);
                }

                if (use_throttle_table_for_speed)
                {
                    throttle =
                        goby::util::linear_interpolate(processed_target_speed, speed_to_throttle_);
                    glog.is_debug2() &&
                        glog << group("main") << "using throttle table, processed_target_speed = "
                             << processed_target_speed << " throttle = " << throttle << std::endl;
                }
                else {
                    // Compute new throttle value
                    if (throttle_speed_pid->need_compute())
                    {
                        throttle_speed_pid->compute();
                    }

                    glog.is_debug2() && glog << group("main") << "using speed PID, target_speed = " << target_speed
                                            << " processed_target_speed = " << processed_target_speed
                                            << " actual_speed = " << actual_speed
                                            << " throttle = " << throttle << std::endl;
                }

            }
            break;
        case PID_DEPTH:
            // Compute new throttle value
            if (throttle_depth_pid->need_compute())
            {
                throttle_depth_pid->compute();
                throttle =
                    throttle + THROTTLE_FOR_ZERO_NET_BUOYANCY + cfg().dive_throttle_addition();
            }

            glog.is_debug2() && glog << group("main") << "target_depth = " << target_depth
                                     << ", actual_depth = " << actual_depth
                                     << ", throttle = " << throttle << std::endl;
            break;
    }

    // Heading PID
    if (_rudder_is_using_pid)
    {
        // Make sure track is within 180 degrees of the course
        if (actual_heading > target_heading + 180.0)
        {
            actual_heading -= 360.0;
        }
        if (actual_heading < target_heading - 180.0)
        {
            actual_heading += 360.0;
        }

        // Compute new rudder value
        if (heading_pid->need_compute())
        {
            heading_pid->compute();
        }

        glog.is_debug2() && glog << group("main") << "target_heading = " << target_heading
                                 << ", actual_heading = " << actual_heading
                                 << ", rudder = " << rudder << std::endl;
    }

    // Roll/Pitch PID
    if (_elevator_is_using_pid)
    {
        if (actual_roll > target_roll + 180.0)
        {
            actual_roll -= 360.0;
        }
        if (actual_roll < target_roll - 180.0)
        {
            actual_roll += 360.0;
        }

        if (roll_pid->need_compute())
        {
            roll_pid->compute();
        }

        if (actual_pitch > target_pitch + 180.0)
        {
            actual_pitch -= 360.0;
        }
        if (actual_pitch < target_pitch - 180.0)
        {
            actual_pitch += 360.0;
        }

        if (pitch_pid->need_compute())
        {
            pitch_pid->compute();
        }

        glog.is_debug2() && glog << group("main") << "target_pitch = " << target_pitch
                                 << ", actual_pitch = " << actual_pitch
                                 << ", elevator_middle = " << elevator_middle << std::endl;
        glog.is_debug2() && glog << group("main") << "target_roll  = " << target_roll
                                 << ", actual_roll  = " << actual_roll
                                 << ", elevator_delta  = " << elevator_delta << std::endl;

        port_elevator = elevator_middle - elevator_delta;
        stbd_elevator = elevator_middle + elevator_delta;
    }

    // Implement a timeout

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
    if (lastCommandReceived.value() != 0 && (now - lastCommandReceived) > timeout)
    {
        glog.is_warn() && glog << "Timing out after "
                               << static_cast<goby::time::SITime>(timeout).value() << " seconds."
                               << std::endl;
        lastCommandReceived = 0;

        all_stop();
    }

    // Publish the LowControl
    cmd_msg.set_id(id++);
    cmd_msg.set_vehicle(1); // Set this to correct value?
    cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

    auto& control_surfaces = *cmd_msg.mutable_control_surfaces();
    control_surfaces.set_timeout(static_cast<goby::time::SITime>(timeout).value());
    control_surfaces.set_port_elevator(port_elevator);
    control_surfaces.set_stbd_elevator(stbd_elevator);
    control_surfaces.set_rudder(rudder);
    control_surfaces.set_motor(throttle);
    control_surfaces.set_led_switch_on(led_switch_on);

    glog.is_debug2() && glog << group("main") << "Sending command: " << cmd_msg.ShortDebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::low_control>(cmd_msg);
}

void jaiabot::apps::BotPidControl::setThrottleMode(const ThrottleMode newThrottleMode) {
    if (newThrottleMode != _throttleMode) {
        switch (newThrottleMode) {
            case MANUAL:
                break;
            case PID_SPEED:
                throttle_speed_pid->reset_iterm();
                break;
            case PID_DEPTH:
                throttle_depth_pid->reset_iterm();
                break;
        }
    }
    _throttleMode = newThrottleMode;
}

void jaiabot::apps::BotPidControl::toggleRudderPid(const bool enabled) {
    if (enabled != _rudder_is_using_pid) {
        heading_pid->reset_iterm();
    }
    _rudder_is_using_pid = enabled;
}

void jaiabot::apps::BotPidControl::toggleElevatorPid(const bool enabled) {
    if (enabled != _elevator_is_using_pid) {
        roll_pid->reset_iterm();
        pitch_pid->reset_iterm();
    }
    _elevator_is_using_pid = enabled;
}

void jaiabot::apps::BotPidControl::handle_engineering_command(const jaiabot::protobuf::PIDControl& command)
{
    glog.is_debug1() && glog << "Received engineering command: " << command.ShortDebugString() << std::endl;

    lastCommandReceived = goby::time::SystemClock::now<goby::time::MicroTime>();

    // Timeout
    if (command.has_timeout())
    {
        timeout = command.timeout_with_units<decltype(timeout)>();
    }
    else
    {
        timeout = cfg().default_timeout_with_units<decltype(timeout)>();
    }

    // Throttle
    if (command.has_throttle())
    {
        setThrottleMode(MANUAL);
        throttle = command.throttle();
    }
    // Speed
    if (command.has_speed())
    {
        auto speed = command.speed();

        if (speed.has_target())
        {
            setThrottleMode(PID_SPEED);
            target_speed = speed.target();
        }

        if (speed.has_kp())
        {
            throttle_speed_pid->tune(speed.kp(), speed.ki(), speed.kd());
        }

    }
    // Depth PID for dive
    if (command.has_depth())
    {
        auto depth = command.depth();

        if (depth.has_target())
        {
            setThrottleMode(PID_DEPTH);
            target_depth = depth.target();
        }

        if (depth.has_kp())
        {
            throttle_depth_pid->tune(depth.kp(), depth.ki(), depth.kd());
        }
    }

    // Rudder
    if (command.has_rudder())
    {
        rudder = command.rudder();
        toggleRudderPid(false);
    }
    // Heading
    if (command.has_heading())
    {
        auto heading = command.heading();

        if (heading.has_target())
        {
            toggleRudderPid(true);
            target_heading = heading.target();
        }

        if (heading.has_kp())
        {
            heading_pid->tune(heading.kp(), heading.ki(), heading.kd());
        }
    }

    // Elevators
    if (command.has_port_elevator())
    {
        port_elevator = command.port_elevator();
        toggleElevatorPid(false);
    }
    if (command.has_stbd_elevator())
    {
        stbd_elevator = command.stbd_elevator();
        toggleElevatorPid(false);
    }

    // Roll
    if (command.has_roll())
    {
        auto roll = command.roll();

        if (roll.has_target())
        {
            toggleElevatorPid(true);
            target_roll = roll.target();
        }

        if (roll.has_kp())
        {
            roll_pid->tune(roll.kp(), roll.ki(), roll.kd());
        }
    }

    // Pitch
    if (command.has_pitch())
    {
        auto pitch = command.pitch();

        if (pitch.has_target())
        {
            toggleElevatorPid(true);
            target_pitch = pitch.target();
        }

        if (pitch.has_kp())
        {
            pitch_pid->tune(pitch.kp(), pitch.ki(), pitch.kd());
        }
    }

    if (command.has_led_switch_on())
    {
        led_switch_on = command.led_switch_on();
    }
}

// Handle DesiredSetpoint messages from high_control.proto

void jaiabot::apps::BotPidControl::handle_command(
    const jaiabot::protobuf::DesiredSetpoints& command)
{
    glog.is_verbose() && glog << "Received command: " << command.ShortDebugString() << std::endl;

    lastCommandReceived = goby::time::SystemClock::now<goby::time::MicroTime>();

    switch (command.type())
    {
        case jaiabot::protobuf::SETPOINT_STOP:
            throttle = 0.0;
            setThrottleMode(MANUAL);
            rudder = 0.0;
            toggleRudderPid(false);
            break;
        case jaiabot::protobuf::SETPOINT_IVP_HELM: handle_helm_course(command.helm_course()); break;
        case jaiabot::protobuf::SETPOINT_REMOTE_CONTROL:
            handle_remote_control(command.remote_control());
            break;
        case jaiabot::protobuf::SETPOINT_DIVE: handle_dive_depth(command); break;
        case jaiabot::protobuf::SETPOINT_POWERED_ASCENT: handle_powered_ascent(); break;
    }

    // Special case:  don't track the rudder if the target speed is zero, and the throttle is speed-PID
    if (_throttleMode == PID_SPEED && target_speed == 0.0)
    {
        all_stop();
    }

    // Special case:  don't track the rudder during a dive
    if (_throttleMode == PID_DEPTH)
    {
        toggleRudderPid(false);
        rudder = 0;
    }
}

void jaiabot::apps::BotPidControl::handle_helm_course(
    const goby::middleware::frontseat::protobuf::DesiredCourse& desired_course)
{
    if (desired_course.has_heading())
    {
        toggleRudderPid(true);
        target_heading = desired_course.heading();
    }
    if (desired_course.has_speed())
    {
        setThrottleMode(PID_SPEED);
        target_speed = desired_course.speed();
    }
    // TO DO:  PID for the depth that uses elevators while moving forward
    if (desired_course.has_pitch())
    {
        toggleElevatorPid(true);
        target_pitch = desired_course.pitch();
    }
    if (desired_course.has_roll())
    {
        toggleElevatorPid(true);
        target_roll = desired_course.roll();
    }
    // TO DO:  PID for z_rate and altitude, if present?
}

void jaiabot::apps::BotPidControl::handle_remote_control(
    const jaiabot::protobuf::RemoteControl& remote_control)
{
    if (remote_control.has_heading())
    {
        toggleRudderPid(true);
        target_heading = remote_control.heading();
    }
    if (remote_control.has_speed())
    {
        setThrottleMode(PID_SPEED);
        target_speed = remote_control.speed();
    }
}

void jaiabot::apps::BotPidControl::handle_dive_depth(
    const jaiabot::protobuf::DesiredSetpoints& command)
{
    // No dive PID for now... set to -60% throttle
    /*setThrottleMode(MANUAL);

    if (bounds.motor().has_throttle_dive())
    {
        throttle = bounds.motor().throttle_dive();
    }
    else
    {
        throttle = -35.0;
    }*/

    // Depth PID for dive
    if (command.has_dive_depth())
    {
        setThrottleMode(PID_DEPTH);
        target_depth = command.dive_depth();
    }

    // Set rudder to center
    rudder = 0.0;
    toggleRudderPid(false);
}

void jaiabot::apps::BotPidControl::handle_powered_ascent()
{
    setThrottleMode(MANUAL);

    if (bounds.motor().has_throttle_ascent())
    {
        throttle = bounds.motor().throttle_ascent();
    }
    else
    {
        throttle = 25.0;
    }
}

void copy_pid(Pid* pid, jaiabot::protobuf::PIDControl_PIDSettings* pid_settings) {
    pid_settings->set_target(pid->get_setpoint());
    pid_settings->set_kp(std::abs(pid->get_Kp()));
    pid_settings->set_ki(std::abs(pid->get_Ki()));
    pid_settings->set_kd(std::abs(pid->get_Kd()));
}

// Engineering status
void jaiabot::apps::BotPidControl::publish_engineering_status() {
    auto pid_control_status = jaiabot::protobuf::PIDControl();

    copy_pid(throttle_speed_pid, pid_control_status.mutable_speed());
    copy_pid(throttle_depth_pid, pid_control_status.mutable_depth());
    copy_pid(heading_pid, pid_control_status.mutable_heading());
    copy_pid(pitch_pid, pid_control_status.mutable_pitch());
    copy_pid(roll_pid, pid_control_status.mutable_roll());

    pid_control_status.set_throttle(throttle);
    pid_control_status.set_rudder(rudder);

    glog.is_debug1() && glog << "Publishing status: " << pid_control_status.ShortDebugString() << endl;

    interprocess().publish<jaiabot::groups::engineering_status>(pid_control_status);
}

void jaiabot::apps::BotPidControl::all_stop()
{
    throttle = 0.0;
    setThrottleMode(MANUAL);

    rudder = 0.0;
    toggleRudderPid(false);
}

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

#include "jaiabot/messages/arduino.pb.h"
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
    : zeromq::MultiThreadApplication<config::BotPidControl>(1.0 * si::hertz)
{
    auto app_config = cfg();

    // Setup our bounds configuration
    if (app_config.has_bounds())
    {
        bounds_ = app_config.bounds();
    }

    if (bounds_.motor().has_throttle_zero_net_buoyancy())
    {
        THROTTLE_FOR_ZERO_NET_BUOYANCY = bounds_.motor().throttle_zero_net_buoyancy();
    }

    glog.is_verbose() && glog << "BotPidControl starting" << std::endl;
    glog.is_verbose() && glog << "Config: " << app_config.ShortDebugString() << std::endl;

    // Setup speed => throttle table
    if (app_config.has_use_throttle_table_for_speed())
    {
        use_throttle_table_for_speed_ = app_config.use_throttle_table_for_speed();
    }

    if (use_throttle_table_for_speed_)
    {
        if (app_config.throttle_table_size() < 2)
            glog.is_die() &&
                glog << "Must define at least two entries in the 'throttle_table' when "
                        "using 'use_throttle_table_for_speed == true'"
                     << std::endl;

        for (const auto& entry : app_config.throttle_table())
            speed_to_throttle_.insert(std::make_pair(entry.speed(), entry.throttle()));
    }

    full_speed_window_ = app_config.full_speed_window();
    glog.is_warn() && glog << "full_speed_window = " << full_speed_window_ << endl;

    // Create our PID objects
    if (cfg().has_throttle_speed_pid_gains())
    {
        auto& gains = cfg().throttle_speed_pid_gains();
        throttle_speed_pid_ = new Pid(&actual_speed_, &throttle_, &processed_target_speed_,
                                      gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        throttle_speed_pid_ =
            new Pid(&actual_speed_, &throttle_, &processed_target_speed_, 20, 10, 0);
    }
    throttle_speed_pid_->set_limits(0.0, 100.0);
    throttle_speed_pid_->set_auto();

    /**
     * @brief Negative PIDs for throttle_depth_pid (Input positive, output negative)
     * 
     */
    if (cfg().has_throttle_depth_pid_gains())
    {
        auto& gains = cfg().throttle_depth_pid_gains();
        throttle_depth_pid_ =
            new Pid(&actual_depth_, &throttle_, &target_depth_, gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        throttle_depth_pid_ = new Pid(&actual_depth_, &throttle_, &target_depth_, 10, 1.6, 12.8);
    }
    throttle_depth_pid_->set_auto();
    throttle_depth_pid_->set_direction(E_PID_REVERSE);
    throttle_depth_pid_->set_limits(-100.0, -THROTTLE_FOR_ZERO_NET_BUOYANCY);

    if (cfg().has_heading_pid_gains())
    {
        auto& gains = cfg().heading_pid_gains();
        heading_pid_ = new Pid(&actual_heading_, &rudder_, &target_heading_, gains.kp(), gains.ki(),
                               gains.kd());
    }
    else
    {
        heading_pid_ = new Pid(&actual_heading_, &rudder_, &target_heading_, 0.7, 0.005, 0.2);
    }
    heading_pid_->set_limits(-100.0, 100.0);
    heading_pid_->set_auto();

    if (cfg().has_heading_constant_pid_gains())
    {
        auto& gains = cfg().heading_constant_pid_gains();
        heading_constant_pid_ = new Pid(&actual_heading_, &rudder_, &target_heading_, gains.kp(),
                                        gains.ki(), gains.kd());
    }
    else
    {
        heading_constant_pid_ =
            new Pid(&actual_heading_, &rudder_, &target_heading_, 0.7, 0.005, 0.2);
    }
    heading_constant_pid_->set_limits(-100.0, 100.0);
    heading_constant_pid_->set_auto();

    if (cfg().has_roll_pid_gains())
    {
        auto& gains = cfg().roll_pid_gains();
        roll_pid_ = new Pid(&actual_roll_, &elevator_delta_, &target_roll_, gains.kp(), gains.ki(),
                            gains.kd());
    }
    else
    {
        roll_pid_ = new Pid(&actual_roll_, &elevator_delta_, &target_roll_, 1, 0.5, 0);
    }
    roll_pid_->set_limits(-100.0, 100.0);
    roll_pid_->set_auto();

    if (cfg().has_pitch_pid_gains())
    {
        auto& gains = cfg().pitch_pid_gains();
        pitch_pid_ = new Pid(&actual_pitch_, &elevator_middle_, &target_pitch_, gains.kp(),
                             gains.ki(), gains.kd());
    }
    else
    {
        pitch_pid_ = new Pid(&actual_pitch_, &elevator_middle_, &target_pitch_, 1, 0.5, 0);
    }
    pitch_pid_->set_limits(-100.0, 100.0);
    pitch_pid_->set_auto();

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
                    actual_heading_ = attitude.heading();
                }

                if (attitude.has_roll())
                {
                    actual_roll_ = attitude.roll();
                }

                if (attitude.has_pitch())
                {
                    actual_pitch_ = attitude.pitch();
                }
            }

            if (node_status.has_speed())
            {
                auto speed = node_status.speed();

                if (speed.has_over_ground())
                {
                    actual_speed_ = speed.over_ground();
                }
            }

            if (node_status.has_global_fix() && node_status.global_fix().has_depth())
            {
                actual_depth_ = node_status.global_fix().depth();
            }

            glog.is_debug2() && glog << "Actual speed: " << actual_speed_
                                     << " heading: " << actual_heading_
                                     << " depth: " << actual_depth_ << std::endl;
        });

    interprocess().subscribe<jaiabot::groups::arduino_to_pi>(
        [this](const jaiabot::protobuf::ArduinoResponse& arduino_response)
        {
            if (arduino_response.has_motor())
            {
                arduino_motor_throttle_ = ((arduino_response.motor() - 1500) / 400);
                glog.is_debug2() && glog << "Arduino Reported Throttle: " << arduino_motor_throttle_
                                         << endl;
            }
        });
}

void jaiabot::apps::BotPidControl::loop()
{
    // Heartbeat publish to arduino to ensure
    // values are up-to-date
    publish_low_control();
}

void jaiabot::apps::BotPidControl::publish_low_control()
{
    glog.is_debug3() && glog << throttle_speed_pid_->description() << endl;
    glog.is_debug3() && glog << throttle_depth_pid_->description() << endl;
    glog.is_debug3() && glog << heading_pid_->description() << endl;
    glog.is_debug3() && glog << heading_constant_pid_->description() << endl;
    glog.is_debug3() && glog << roll_pid_->description() << endl;
    glog.is_debug3() && glog << pitch_pid_->description() << endl;

    // Speed PID
    switch (_throttleMode_)
    {
        case MANUAL: break;
        case PID_SPEED:

            {
                // Make processed_target_speed proportional to the dot product between our heading and desired heading, with a minimum value to orient ourselves
                float speed_multiplier = 1.0;

                if (_rudder_is_using_pid_ && actual_heading_ > -1000.0)
                {
                    // Apply a step function to the speed:
                    //  * 100% of desired speed when we are with n degrees
                    //  * Desired speed times dot product of heading error otherwise
                    float heading_error_deg = actual_heading_ - target_heading_;
                    if (abs(heading_error_deg) < full_speed_window_)
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
                processed_target_speed_ = target_speed_ * speed_multiplier;

                if (processed_target_speed_ != 0.0)
                {
                    processed_target_speed_ = max(0.5f, processed_target_speed_);
                }

                if (use_throttle_table_for_speed_)
                {
                    throttle_ =
                        goby::util::linear_interpolate(processed_target_speed_, speed_to_throttle_);
                    glog.is_debug2() &&
                        glog << group("main") << "using throttle table, processed_target_speed = "
                             << processed_target_speed_ << " throttle = " << throttle_ << std::endl;
                }
                else {
                    // Compute new throttle value
                    if (throttle_speed_pid_->need_compute())
                    {
                        throttle_speed_pid_->compute();
                    }

                    glog.is_debug2() &&
                        glog << group("main") << "using speed PID, target_speed = " << target_speed_
                             << " processed_target_speed = " << processed_target_speed_
                             << " actual_speed = " << actual_speed_ << " throttle = " << throttle_
                             << std::endl;
                }

            }
            break;
        case PID_DEPTH:
            // Compute new throttle value
            if (throttle_depth_pid_->need_compute())
            {
                throttle_depth_pid_->compute();
                throttle_ = throttle_ + THROTTLE_FOR_ZERO_NET_BUOYANCY;
            }

            glog.is_debug2() && glog << group("main") << "target_depth = " << target_depth_
                                     << ", actual_depth = " << actual_depth_
                                     << ", throttle = " << throttle_ << std::endl;
            break;
    }

    // Heading PID
    if (_rudder_is_using_pid_)
    {
        // Make sure track is within 180 degrees of the course
        if (actual_heading_ > target_heading_ + 180.0)
        {
            actual_heading_ -= 360.0;
        }
        if (actual_heading_ < target_heading_ - 180.0)
        {
            actual_heading_ += 360.0;
        }

        if (!is_heading_constant_)
        {
            // Compute new rudder value
            if (heading_pid_->need_compute())
            {
                heading_pid_->compute();
            }
        }
        else
        {
            // Compute new rudder value
            if (heading_constant_pid_->need_compute())
            {
                heading_constant_pid_->compute();
            }
        }

        glog.is_debug2() && glog << group("main") << "target_heading = " << target_heading_
                                 << ", actual_heading = " << actual_heading_
                                 << ", rudder = " << rudder_
                                 << ", is_heading_constant = " << is_heading_constant_ << std::endl;
    }

    // Roll/Pitch PID
    if (_elevator_is_using_pid_)
    {
        if (actual_roll_ > target_roll_ + 180.0)
        {
            actual_roll_ -= 360.0;
        }
        if (actual_roll_ < target_roll_ - 180.0)
        {
            actual_roll_ += 360.0;
        }

        if (roll_pid_->need_compute())
        {
            roll_pid_->compute();
        }

        if (actual_pitch_ > target_pitch_ + 180.0)
        {
            actual_pitch_ -= 360.0;
        }
        if (actual_pitch_ < target_pitch_ - 180.0)
        {
            actual_pitch_ += 360.0;
        }

        if (pitch_pid_->need_compute())
        {
            pitch_pid_->compute();
        }

        glog.is_debug2() && glog << group("main") << "target_pitch = " << target_pitch_
                                 << ", actual_pitch = " << actual_pitch_
                                 << ", elevator_middle = " << elevator_middle_ << std::endl;
        glog.is_debug2() && glog << group("main") << "target_roll  = " << target_roll_
                                 << ", actual_roll  = " << actual_roll_
                                 << ", elevator_delta  = " << elevator_delta_ << std::endl;

        port_elevator_ = elevator_middle_ - elevator_delta_;
        stbd_elevator_ = elevator_middle_ + elevator_delta_;
    }

    // Implement a timeout

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
    if (lastCommandReceived_.value() != 0 && (now - lastCommandReceived_) > timeout_)
    {
        glog.is_warn() && glog << "Timing out after "
                               << static_cast<goby::time::SITime>(timeout_).value() << " seconds."
                               << std::endl;
        lastCommandReceived_ = 0;

        all_stop();
    }

    // Publish the LowControl
    cmd_msg_.set_id(id_++);
    cmd_msg_.set_vehicle(1); // Set this to correct value?
    cmd_msg_.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

    auto& control_surfaces = *cmd_msg_.mutable_control_surfaces();
    control_surfaces.set_timeout(static_cast<goby::time::SITime>(timeout_).value());
    control_surfaces.set_port_elevator(port_elevator_);
    control_surfaces.set_stbd_elevator(stbd_elevator_);
    control_surfaces.set_rudder(rudder_);
    control_surfaces.set_motor(throttle_);
    control_surfaces.set_led_switch_on(led_switch_on);

    glog.is_debug2() && glog << group("main") << "Sending command: " << cmd_msg_.ShortDebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::low_control>(cmd_msg_);
}

void jaiabot::apps::BotPidControl::setThrottleMode(const ThrottleMode newThrottleMode) {
    if (newThrottleMode != _throttleMode_)
    {
        switch (newThrottleMode) {
            case MANUAL:
                break;
            case PID_SPEED: throttle_speed_pid_->reset_iterm(); break;
            case PID_DEPTH:
                // Set the throttle to what the arduino is reporting
                // based on its ramping. This way our PID is not skewed
                // when switching from manual to dive.
                throttle_ = arduino_motor_throttle_;
                glog.is_debug2() && glog << "Init Depth PID Throttle: " << throttle_ << endl;
                throttle_depth_pid_->reset_iterm();
                break;
        }
    }
    _throttleMode_ = newThrottleMode;
}

void jaiabot::apps::BotPidControl::toggleRudderPid(const bool enabled,
                                                   const bool is_heading_constant)
{
    if (enabled != _rudder_is_using_pid_)
    {
        heading_pid_->reset_iterm();
    }
    _rudder_is_using_pid_ = enabled;
    is_heading_constant_ = is_heading_constant;
    glog.is_debug2() && glog << group("main") << "_rudder_is_using_pid_: " << _rudder_is_using_pid_
                             << ", is_heading_constant_: " << is_heading_constant_ << std::endl;
}

void jaiabot::apps::BotPidControl::toggleElevatorPid(const bool enabled) {
    if (enabled != _elevator_is_using_pid_)
    {
        roll_pid_->reset_iterm();
        pitch_pid_->reset_iterm();
    }
    _elevator_is_using_pid_ = enabled;
}

void jaiabot::apps::BotPidControl::handle_engineering_command(const jaiabot::protobuf::PIDControl& command)
{
    glog.is_verbose() && glog << "Received engineering command: " << command.ShortDebugString()
                              << std::endl;

    lastCommandReceived_ = goby::time::SystemClock::now<goby::time::MicroTime>();

    // Timeout
    if (command.has_timeout())
    {
        timeout_ = command.timeout_with_units<decltype(timeout_)>();
    }
    else
    {
        timeout_ = cfg().default_timeout_with_units<decltype(timeout_)>();
    }

    // Throttle
    if (command.has_throttle())
    {
        setThrottleMode(MANUAL);
        throttle_ = command.throttle();
    }
    // Speed
    if (command.has_speed())
    {
        auto speed = command.speed();

        if (speed.has_target())
        {
            setThrottleMode(PID_SPEED);
            target_speed_ = speed.target();
        }

        if (speed.has_kp())
        {
            throttle_speed_pid_->tune(speed.kp(), speed.ki(), speed.kd());
        }

    }
    // Depth PID for dive
    if (command.has_depth())
    {
        auto depth = command.depth();

        if (depth.has_target())
        {
            setThrottleMode(PID_DEPTH);
            target_depth_ = depth.target();
        }

        if (depth.has_kp())
        {
            throttle_depth_pid_->tune(depth.kp(), depth.ki(), depth.kd());
        }
    }

    // Rudder
    if (command.has_rudder())
    {
        rudder_ = command.rudder();
        toggleRudderPid(false);
    }
    // Heading
    if (command.has_heading())
    {
        auto heading = command.heading();

        if (heading.has_target())
        {
            toggleRudderPid(true);
            target_heading_ = heading.target();
        }

        if (heading.has_kp())
        {
            heading_pid_->tune(heading.kp(), heading.ki(), heading.kd());
            glog.is_verbose() && glog << "heading_ tune: " << heading.kp() << std::endl;
        }
    }
    // Heading Constant
    if (command.has_heading_constant())
    {
        auto heading_constant = command.heading_constant();

        if (heading_constant.has_target())
        {
            toggleRudderPid(true, true);
            target_heading_ = heading_constant.target();
        }

        if (heading_constant.has_kp())
        {
            heading_constant_pid_->tune(heading_constant.kp(), heading_constant.ki(),
                                        heading_constant.kd());
            glog.is_verbose() && glog << "heading_constant_pid_ tune: " << heading_constant.kp()
                                      << std::endl;
        }
    }

    // Elevators
    if (command.has_port_elevator())
    {
        port_elevator_ = command.port_elevator();
        toggleElevatorPid(false);
    }
    if (command.has_stbd_elevator())
    {
        stbd_elevator_ = command.stbd_elevator();
        toggleElevatorPid(false);
    }

    // Roll
    if (command.has_roll())
    {
        auto roll = command.roll();

        if (roll.has_target())
        {
            toggleElevatorPid(true);
            target_roll_ = roll.target();
        }

        if (roll.has_kp())
        {
            roll_pid_->tune(roll.kp(), roll.ki(), roll.kd());
        }
    }

    // Pitch
    if (command.has_pitch())
    {
        auto pitch = command.pitch();

        if (pitch.has_target())
        {
            toggleElevatorPid(true);
            target_pitch_ = pitch.target();
        }

        if (pitch.has_kp())
        {
            pitch_pid_->tune(pitch.kp(), pitch.ki(), pitch.kd());
        }
    }

    if (command.has_led_switch_on())
    {
        led_switch_on = command.led_switch_on();
    }

    publish_low_control();
}

// Handle DesiredSetpoint messages from high_control.proto

void jaiabot::apps::BotPidControl::handle_command(
    const jaiabot::protobuf::DesiredSetpoints& command)
{
    glog.is_verbose() && glog << "Received command: " << command.ShortDebugString() << std::endl;

    lastCommandReceived_ = goby::time::SystemClock::now<goby::time::MicroTime>();

    switch (command.type())
    {
        case jaiabot::protobuf::SETPOINT_STOP:
            throttle_ = 0.0;
            setThrottleMode(MANUAL);
            rudder_ = 0.0;
            toggleRudderPid(false);
            break;
        case jaiabot::protobuf::SETPOINT_IVP_HELM: handle_helm_course(command); break;
        case jaiabot::protobuf::SETPOINT_REMOTE_CONTROL:
            handle_remote_control(command.remote_control());
            break;
        case jaiabot::protobuf::SETPOINT_DIVE: handle_dive_depth(command); break;
        case jaiabot::protobuf::SETPOINT_POWERED_ASCENT: handle_powered_ascent(command); break;
    }

    // Special case:  don't track the rudder if the target speed is zero, and the throttle is speed-PID
    if (_throttleMode_ == PID_SPEED && target_speed_ == 0.0)
    {
        all_stop();
    }

    // Special case:  don't track the rudder during a dive
    if (_throttleMode_ == PID_DEPTH)
    {
        toggleRudderPid(false);
        rudder_ = 0;
    }

    publish_low_control();
}

void jaiabot::apps::BotPidControl::handle_helm_course(
    const jaiabot::protobuf::DesiredSetpoints& command)
{
    auto desired_course = command.helm_course();
    if (desired_course.has_heading())
    {
        toggleRudderPid(true, command.is_helm_constant_course());
        target_heading_ = desired_course.heading();
    }
    if (desired_course.has_speed())
    {
        setThrottleMode(PID_SPEED);
        target_speed_ = desired_course.speed();
    }
    // TO DO:  PID for the depth that uses elevators while moving forward
    if (desired_course.has_pitch())
    {
        toggleElevatorPid(true);
        target_pitch_ = desired_course.pitch();
    }
    if (desired_course.has_roll())
    {
        toggleElevatorPid(true);
        target_roll_ = desired_course.roll();
    }
    // TO DO:  PID for z_rate and altitude, if present?
}

void jaiabot::apps::BotPidControl::handle_remote_control(
    const jaiabot::protobuf::RemoteControl& remote_control)
{
    if (remote_control.has_heading())
    {
        toggleRudderPid(true);
        target_heading_ = remote_control.heading();
    }
    if (remote_control.has_speed())
    {
        setThrottleMode(PID_SPEED);
        target_speed_ = remote_control.speed();
    }
}

void jaiabot::apps::BotPidControl::handle_dive_depth(
    const jaiabot::protobuf::DesiredSetpoints& command)
{
    // Depth PID for dive
    if (command.has_dive_depth())
    {
        setThrottleMode(PID_DEPTH);
        target_depth_ = command.dive_depth();
    }
    else if (bounds_.motor().has_throttle_dive())
    {
        setThrottleMode(MANUAL);
        throttle_ = bounds_.motor().throttle_dive();
    }
    else
    {
        setThrottleMode(MANUAL);
        throttle_ = -35.0;
    }

    // Set rudder to center
    rudder_ = 0.0;
    toggleRudderPid(false);
}

void jaiabot::apps::BotPidControl::handle_powered_ascent(
    const jaiabot::protobuf::DesiredSetpoints& command)
{
    setThrottleMode(MANUAL);

    if (command.has_throttle())
    {
        throttle_ = command.throttle();
    }
    else if (bounds_.motor().has_throttle_ascent())
    {
        throttle_ = bounds_.motor().throttle_ascent();
    }
    else
    {
        throttle_ = 25.0;
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

    copy_pid(throttle_speed_pid_, pid_control_status.mutable_speed());
    copy_pid(throttle_depth_pid_, pid_control_status.mutable_depth());
    copy_pid(heading_pid_, pid_control_status.mutable_heading());
    copy_pid(pitch_pid_, pid_control_status.mutable_pitch());
    copy_pid(roll_pid_, pid_control_status.mutable_roll());
    copy_pid(heading_constant_pid_, pid_control_status.mutable_heading_constant());

    pid_control_status.set_throttle(throttle_);
    pid_control_status.set_rudder(rudder_);

    glog.is_debug1() && glog << "Publishing status: " << pid_control_status.ShortDebugString() << endl;

    interprocess().publish<jaiabot::groups::engineering_status>(pid_control_status);
}

void jaiabot::apps::BotPidControl::all_stop()
{
    throttle_ = 0.0;
    setThrottleMode(MANUAL);

    rudder_ = 0.0;
    toggleRudderPid(false);
}

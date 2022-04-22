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
#include "jaiabot/messages/vehicle_command.pb.h"
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#define NOW (goby::time::SystemClock::now<goby::time::MicroTime>())

using namespace std;
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

class BotPidControlConfigurator
    : public goby::middleware::ProtobufConfigurator<config::BotPidControl>
{
  public:
    BotPidControlConfigurator(int argc, char* argv[])
        : goby::middleware::ProtobufConfigurator<config::BotPidControl>(argc, argv)
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
    return goby::run<jaiabot::apps::BotPidControl>(
        jaiabot::apps::BotPidControlConfigurator(argc, argv));
}

jaiabot::apps::BotPidControl::BotPidControl()
    : zeromq::MultiThreadApplication<config::BotPidControl>(2 * si::hertz)
{
    glog.is_debug1() && glog << "BotPidControl starting" << std::endl;

    // Create our PID objects
    if (cfg().has_throttle_speed_pid_gains())
    {
        auto& gains = cfg().throttle_speed_pid_gains();
        throttle_speed_pid =
            new Pid(&actual_speed, &throttle, &target_speed, gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        throttle_speed_pid = new Pid(&actual_speed, &throttle, &target_speed, 20, 10, 0);
    }
    throttle_speed_pid->set_limits(0.0, 100.0);
    throttle_speed_pid->set_auto();

    if (cfg().has_throttle_depth_pid_gains())
    {
        auto& gains = cfg().throttle_depth_pid_gains();
        throttle_depth_pid =
            new Pid(&actual_depth, &throttle, &target_depth, gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        throttle_depth_pid = new Pid(&actual_depth, &throttle, &target_depth, 20, 10, 0);
    }
    throttle_depth_pid->set_direction(E_PID_REVERSE);
    throttle_depth_pid->set_limits(-100.0, 100.0);
    throttle_depth_pid->set_auto();

    if (cfg().has_heading_pid_gains())
    {
        auto& gains = cfg().heading_pid_gains();
        heading_pid =
            new Pid(&actual_heading, &rudder, &target_heading, gains.kp(), gains.ki(), gains.kd());
    }
    else
    {
        heading_pid = new Pid(&actual_heading, &rudder, &target_heading, 1, 0.5, 0);
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
    {
        auto on_command_subscribed =
            [this](const goby::middleware::intervehicle::protobuf::Subscription& sub,
                   const goby::middleware::intervehicle::protobuf::AckData& ack)
        {
            glog.is_debug1() && glog << "Received acknowledgment:\n\t" << ack.ShortDebugString()
                                     << "\nfor subscription:\n\t" << sub.ShortDebugString()
                                     << std::endl;
        };

        goby::middleware::Subscriber<jaiabot::protobuf::PIDCommand> command_subscriber{
            cfg().command_sub_cfg(), on_command_subscribed};

        intervehicle().subscribe<jaiabot::groups::pid_control, jaiabot::protobuf::PIDCommand>(
            [this](const jaiabot::protobuf::PIDCommand& command) { handle_command(command); },
            command_subscriber);
    }

    // subscribe for commands from mission manager
    {
        interprocess()
            .subscribe<jaiabot::groups::desired_setpoints, jaiabot::protobuf::DesiredSetpoints>(
                [this](const jaiabot::protobuf::DesiredSetpoints& command)
                { handle_command(command); });
    }

    // Subscribe to get vehicle movement and orientation, for PID targeting
    interprocess().subscribe<jaiabot::groups::bot_status>(
        [this](const jaiabot::protobuf::BotStatus& bot_status)
        {
            glog.is_debug2() && glog << "Received bot status: " << bot_status.ShortDebugString()
                                     << std::endl;

            if (bot_status.has_attitude())
            {
                auto attitude = bot_status.attitude();

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

            if (bot_status.has_speed())
            {
                auto speed = bot_status.speed();

                if (speed.has_over_ground())
                {
                    actual_speed = speed.over_ground();
                }
            }

            if (bot_status.has_depth())
            {
                actual_depth = bot_status.depth();
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
    switch (throttleMode)
    {
        case MANUAL: break;
        case PID_SPEED:
            // Compute new throttle value
            if (throttle_speed_pid->need_compute())
            {
                throttle_speed_pid->compute();
            }

            glog.is_debug2() && glog << group("main") << "target_speed = " << target_speed
                                     << ", actual_speed = " << actual_speed
                                     << ", throttle = " << throttle << std::endl;
            break;
        case PID_DEPTH:
            // Compute new throttle value
            if (throttle_depth_pid->need_compute())
            {
                throttle_depth_pid->compute();
            }

            glog.is_debug2() && glog << group("main") << "target_depth = " << target_depth
                                     << ", actual_depth = " << actual_depth
                                     << ", throttle = " << throttle << std::endl;
            break;
    }

    // Heading PID
    if (rudder_is_using_pid)
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
    if (elevator_is_using_pid)
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

        throttle = 0.0;
        throttleMode = MANUAL;
    }

    // Publish the VehicleCommand

    jaiabot::protobuf::VehicleCommand cmd_msg;

    static std::atomic<int> id(0);

    cmd_msg.set_id(id++);
    cmd_msg.set_vehicle(1); // Set this to correct value?
    cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    cmd_msg.set_command_type(jaiabot::protobuf::VehicleCommand_CommandType_LowLevel);

    auto& control_surfaces = *cmd_msg.mutable_control_surfaces();
    control_surfaces.set_timeout(static_cast<goby::time::SITime>(timeout).value());
    control_surfaces.set_port_elevator(port_elevator);
    control_surfaces.set_stbd_elevator(stbd_elevator);
    control_surfaces.set_rudder(rudder);
    control_surfaces.set_motor(throttle);

    glog.is_debug2() && glog << group("main") << "Sending command: " << cmd_msg.ShortDebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::vehicle_command>(cmd_msg);
}

void jaiabot::apps::BotPidControl::handle_command(const jaiabot::protobuf::PIDCommand& command)
{
    glog.is_debug1() && glog << "Received command: " << command.ShortDebugString() << std::endl;

    interprocess().publish<jaiabot::groups::bot_status>(command);

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
        throttleMode = MANUAL;
        throttle = command.throttle();
    }
    // Speed
    if (command.has_speed())
    {
        auto speed = command.speed();

        if (speed.has_target())
        {
            throttleMode = PID_SPEED;
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
            throttleMode = PID_DEPTH;
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
        rudder_is_using_pid = false;
    }
    // Heading
    if (command.has_heading())
    {
        auto heading = command.heading();

        if (heading.has_target())
        {
            rudder_is_using_pid = true;
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
        elevator_is_using_pid = false;
    }
    if (command.has_stbd_elevator())
    {
        stbd_elevator = command.stbd_elevator();
        elevator_is_using_pid = false;
    }

    // Roll
    if (command.has_roll())
    {
        auto roll = command.roll();

        if (roll.has_target())
        {
            elevator_is_using_pid = true;
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
            elevator_is_using_pid = true;
            target_pitch = pitch.target();
        }

        if (pitch.has_kp())
        {
            pitch_pid->tune(pitch.kp(), pitch.ki(), pitch.kd());
        }
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
            throttleMode = MANUAL;
            break;
        case jaiabot::protobuf::SETPOINT_IVP_HELM: handle_helm_course(command.helm_course()); break;
        case jaiabot::protobuf::SETPOINT_REMOTE_CONTROL:
            handle_remote_control(command.remote_control());
            break;
        case jaiabot::protobuf::SETPOINT_DIVE: handle_dive_depth(command.dive_depth()); break;
        case jaiabot::protobuf::SETPOINT_POWERED_ASCENT: handle_powered_ascent(); break;
    }
}

void jaiabot::apps::BotPidControl::handle_helm_course(
    const goby::middleware::frontseat::protobuf::DesiredCourse& desired_course)
{
    if (desired_course.has_heading())
    {
        rudder_is_using_pid = true;
        target_heading = desired_course.heading();
    }
    if (desired_course.has_speed())
    {
        throttleMode = PID_SPEED;
        target_speed = desired_course.speed();
    }
    // TO DO:  PID for the depth that uses elevators while moving forward
    if (desired_course.has_pitch())
    {
        elevator_is_using_pid = true;
        target_pitch = desired_course.pitch();
    }
    if (desired_course.has_roll())
    {
        elevator_is_using_pid = true;
        target_roll = desired_course.roll();
    }
    // TO DO:  PID for z_rate and altitude, if present?
}

void jaiabot::apps::BotPidControl::handle_remote_control(
    const jaiabot::protobuf::RemoteControl& remote_control)
{
    if (remote_control.has_heading())
    {
        rudder_is_using_pid = true;
        target_heading = remote_control.heading();
    }
    if (remote_control.has_speed())
    {
        throttleMode = PID_SPEED;
        target_speed = remote_control.speed();
    }
}

void jaiabot::apps::BotPidControl::handle_dive_depth(const double& dive_depth)
{
    throttleMode = PID_DEPTH;
    target_depth = dive_depth;
}

void jaiabot::apps::BotPidControl::handle_powered_ascent()
{
    throttleMode = MANUAL;
    throttle = 50.0;
}

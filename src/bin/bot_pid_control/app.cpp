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

#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/frontseat/groups.h>
#include "jaiabot/messages/vehicle_command.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

#define NOW (goby::time::SystemClock::now<goby::time::MicroTime>())

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

    throttle_speed_pid = new Pid(&actual_speed, &throttle, &target_speed, 1.0, 0.0, 0.0);
    throttle_speed_pid->set_limits(-100.0, 100.0);
    throttle_speed_pid->set_auto();

    throttle_depth_pid = new Pid(&actual_depth, &throttle, &target_depth, 1.0, 0.0, 0.0);
    throttle_depth_pid->set_direction(E_PID_REVERSE);
    throttle_depth_pid->set_limits(-100.0, 100.0);
    throttle_depth_pid->set_auto();

    course_pid = new Pid(&actual_heading, &rudder, &target_heading, heading_kp, heading_ki, heading_kd);
    course_pid->set_limits(-100.0, 100.0);
    course_pid->set_auto();

    roll_pid = new Pid(&actual_roll, &elevator_delta, &target_roll, roll_kp, roll_ki, roll_kd);
    roll_pid->set_limits(-100.0, 100.0);
    roll_pid->set_auto();

    pitch_pid = new Pid(&actual_pitch, &elevator_middle, &target_pitch, pitch_kp, pitch_ki, pitch_kd);
    pitch_pid->set_limits(-100.0, 100.0);
    pitch_pid->set_auto();

    // subscribe for commands
    {
        auto on_command_subscribed =
            [this](const goby::middleware::intervehicle::protobuf::Subscription& sub,
                   const goby::middleware::intervehicle::protobuf::AckData& ack) {
                glog.is_debug1() && glog << "Received acknowledgment:\n\t" << ack.ShortDebugString()
                                         << "\nfor subscription:\n\t" << sub.ShortDebugString()
                                         << std::endl;
            };

        goby::middleware::Subscriber<Command> command_subscriber{
            cfg().command_sub_cfg(), on_command_subscribed};

        intervehicle().subscribe<jaiabot::groups::pid_control, Command>(
            [this](const Command& command) { handle_command(command); }, command_subscriber);
    }

    // Subscribe to get vehicle yaw (for testing)
    interprocess().subscribe<jaiabot::groups::bot_status>([this](const jaiabot::protobuf::BotStatus& bot_status) {
        glog.is_debug2() && glog << "Received bot status: " << bot_status.ShortDebugString()
                                    << std::endl;

        if (bot_status.has_attitude()) {
            auto attitude = bot_status.attitude();

            if (attitude.has_heading()) {
                actual_heading = attitude.heading();
            }

            if (attitude.has_roll()) {
                actual_roll = attitude.roll();
            }

            if (attitude.has_pitch()) {
                actual_pitch = attitude.pitch();
            }
        }

        if (bot_status.has_speed()) {
            auto speed = bot_status.speed();

            if (speed.has_over_ground()) {
                actual_speed = speed.over_ground();
            }
        }

        if (bot_status.has_depth()) {
            actual_depth = bot_status.depth();
        }

        glog.is_debug2() && glog << "Actual speed: " << actual_speed << " heading: " << actual_heading << " depth: " << actual_depth << std::endl;
    });

}

void jaiabot::apps::BotPidControl::loop()
{

    // Speed PID
    switch (throttleMode) {
        case MANUAL:
            break;
        case PID_SPEED:
            // Compute new throttle value
            if (throttle_speed_pid->need_compute()) {
                throttle_speed_pid->compute();
            }

            glog.is_debug1() && glog << group("main") << "target_speed = " << target_speed << ", actual_speed = " << actual_speed << ", throttle = " << throttle << std::endl;
            break;
        case PID_DEPTH:
            // Compute new throttle value
            if (throttle_depth_pid->need_compute()) {
                throttle_depth_pid->compute();
            }

            glog.is_debug1() && glog << group("main") << "target_depth = " << target_depth << ", actual_depth = " << actual_depth << ", throttle = " << throttle << std::endl;
            break;
    }

    // Heading PID
    if (rudder_is_using_pid) {
        // Make sure track is within 180 degrees of the course
        if (actual_heading > target_heading + 180.0) {
            actual_heading -= 360.0;
        }
        if (actual_heading < target_heading - 180.0) {
            actual_heading += 360.0;
        }

        // Compute new rudder value
        if (course_pid->need_compute()) {
            course_pid->compute();
        }

        glog.is_debug1() && glog << group("main") << "target_heading = " << target_heading << ", actual_heading = " << actual_heading << ", rudder = " << rudder << std::endl;
    }

    // Roll/Pitch PID
    if (elevator_is_using_pid) {
        if (actual_roll > target_roll + 180.0) {
            actual_roll -= 360.0;
        }
        if (actual_roll < target_roll - 180.0) {
            actual_roll += 360.0;
        }

        if (roll_pid->need_compute()) {
            roll_pid->compute();
        }

        if (actual_pitch > target_pitch + 180.0) {
            actual_pitch -= 360.0;
        }
        if (actual_pitch < target_pitch - 180.0) {
            actual_pitch += 360.0;
        }

        if (pitch_pid->need_compute()) {
            pitch_pid->compute();
        }

        glog.is_debug1() && glog << group("main") << "target_pitch = " << target_pitch << ", actual_pitch = " << actual_pitch << ", elevator_middle = " << elevator_middle << std::endl;
        glog.is_debug1() && glog << group("main") << "target_roll  = " << target_roll <<  ", actual_roll  = " << actual_roll <<  ", elevator_delta  = " << elevator_delta << std::endl;

        port_elevator = elevator_middle - elevator_delta;
        stbd_elevator = elevator_middle + elevator_delta;
    }

    // Implement a timeout

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
    if (lastCommandReceived.value() != 0 &&
        (now - lastCommandReceived).value() > timeout * 1e6) {
        glog.is_warn() && glog << "Timing out after " << timeout << " seconds." << std::endl;
        lastCommandReceived = 0;
        throttle = 0.0;
    }

    // Publish the VehicleCommand

    jaiabot::protobuf::VehicleCommand cmd_msg;


    static std::atomic<int> id(0);

    cmd_msg.set_id(id++);
    cmd_msg.set_vehicle(1); // Set this to correct value?
    cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    cmd_msg.set_command_type(jaiabot::protobuf::VehicleCommand_CommandType_LowLevel);

    auto& control_surfaces = *cmd_msg.mutable_control_surfaces();
    control_surfaces.set_timeout(timeout);
    control_surfaces.set_port_elevator(port_elevator);
    control_surfaces.set_stbd_elevator(stbd_elevator);
    control_surfaces.set_rudder(rudder);
    control_surfaces.set_motor(throttle);

    glog.is_debug1() && glog << group("main") << "Sending command: " << cmd_msg.ShortDebugString() << std::endl;
    interprocess().publish<jaiabot::groups::vehicle_command>(cmd_msg);

}

void jaiabot::apps::BotPidControl::handle_command(const Command& command)
{
    glog.is_debug1() && glog << "Received command: " << command.ShortDebugString() << std::endl;

    lastCommandReceived = goby::time::SystemClock::now<goby::time::MicroTime>();

    // Timeout
    if (command.has_timeout()) {
        timeout = command.timeout();
    }

    // Throttle
    if (command.has_throttle()) {
        throttleMode = MANUAL;
        throttle = command.throttle();
    }
    // Heading
    else if (command.has_speed()) {
        throttleMode = PID_SPEED;
        auto speed = command.speed();

        if (speed.has_target()) {
            target_speed = speed.target();
        }

        if (speed.has_kp()) {
            throttle_speed_pid->tune(speed.kp(), speed.ki(), speed.kd());
        }
    }
    // Depth PID for dive
    else if (command.has_depth()) {
        throttleMode = PID_DEPTH;
        auto depth = command.depth();

        if (depth.has_target()) {
            target_depth = depth.target();
        }

        if (depth.has_kp()) {
            throttle_depth_pid->tune(depth.kp(), depth.ki(), depth.kd());
        }
    }

    // Rudder
    if (command.has_rudder()) {
        rudder = command.rudder();
        rudder_is_using_pid = false;
    }
    // Heading
    else if (command.has_heading()) {
        auto heading = command.heading();
        rudder_is_using_pid = true;

        if (heading.has_target()) {
            target_heading = heading.target();
        }

        bool gains_changed = false;

        if (heading.has_kp())
        {
            heading_kp = heading.kp();
            gains_changed = true;
        }

        if (heading.has_ki())
        {
            heading_ki = heading.ki();
            gains_changed = true;
        }

        if (heading.has_kd())
        {
            heading_kd = heading.kd();
            gains_changed = true;
        }

        if (gains_changed)
        {
            delete course_pid;
            course_pid = new Pid(&actual_heading, &rudder, &target_heading, heading_kp, heading_ki, heading_kd);
            course_pid->set_limits(-100.0, 100.0);
            course_pid->set_auto();
        }

    }

    // Elevators
    if (command.has_port_elevator()) {
        port_elevator = command.port_elevator();
        elevator_is_using_pid = false;
    }
    if (command.has_stbd_elevator()) {
        stbd_elevator = command.stbd_elevator();
        elevator_is_using_pid = false;
    }

    // Roll
    else if (command.has_roll()) {
        auto roll = command.roll();
        elevator_is_using_pid = true;

        if (roll.has_target()) {
            target_roll = roll.target();
        }

        bool gains_changed = false;

        if (roll.has_kp())
        {
            roll_kp = roll.kp();
            gains_changed = true;
        }

        if (roll.has_ki())
        {
            roll_ki = roll.ki();
            gains_changed = true;
        }

        if (roll.has_kd())
        {
            roll_kd = roll.kd();
            gains_changed = true;
        }

        if (gains_changed)
        {
            delete roll_pid;
            roll_pid = new Pid(&actual_roll, &elevator_delta, &target_roll, roll_kp, roll_ki, roll_kd);
            roll_pid->set_limits(-100.0, 100.0);
            roll_pid->set_auto();
        }

    }

    // Pitch
    else if (command.has_pitch()) {
        auto pitch = command.pitch();
        elevator_is_using_pid = true;

        if (pitch.has_target()) {
            target_pitch = pitch.target();
        }

        bool gains_changed = false;

        if (pitch.has_kp())
        {
            pitch_kp = pitch.kp();
            gains_changed = true;
        }

        if (pitch.has_ki())
        {
            pitch_ki = pitch.ki();
            gains_changed = true;
        }

        if (pitch.has_kd())
        {
            pitch_kd = pitch.kd();
            gains_changed = true;
        }

        if (gains_changed)
        {
            delete pitch_pid;
            pitch_pid = new Pid(&actual_pitch, &elevator_middle, &target_pitch, pitch_kp, pitch_ki, pitch_kd);
            pitch_pid->set_limits(-100.0, 100.0);
            pitch_pid->set_auto();
        }

    }

    glog.is_debug2() && glog << "Going to send ack" << std::endl;

    auto ack = CommandAck();
    ack.set_bot_id(cfg().bot_id());
    ack.set_time_with_units(command.time_with_units());

    glog.is_debug2() && glog << "Sending ack: " << ack.ShortDebugString() << std::endl;

    intervehicle().publish<jaiabot::groups::bot_status>(ack);

}

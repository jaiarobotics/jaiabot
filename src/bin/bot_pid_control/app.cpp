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
#include "jaiabot/messages/vehicle_command.pb.h"

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
    : zeromq::MultiThreadApplication<config::BotPidControl>(1 * si::hertz)
{
    glog.is_debug1() && glog << "BotPidControl starting" << std::endl;

    course_pid = new Pid(&actual_heading, &rudder, &target_heading, kp, ki, kd);
    course_pid->set_auto();

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

    // Subscribe to get actual vehicle track
    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
        if (tpv.has_track()) {
            actual_heading = tpv.track();
            glog.is_debug1() && glog << "Actual heading: " << actual_heading << std::endl;
        }
        });

}

void jaiabot::apps::BotPidControl::loop()
{

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

    // Publish the VehicleCommand

    jaiabot::protobuf::VehicleCommand cmd_msg;

    auto& cmd = *cmd_msg.mutable_control_surfaces();

    static std::atomic<int> id(0);

    cmd_msg.set_id(id++);
    cmd_msg.set_vehicle(1); // Set this to correct value?
    cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    cmd_msg.set_command_type(jaiabot::protobuf::VehicleCommand_CommandType_LowLevel);
    cmd.set_timeout(2);
    cmd.set_port_elevator(0);
    cmd.set_stbd_elevator(0);
    cmd.set_rudder(rudder);
    cmd.set_motor(0);

    interprocess().publish<jaiabot::groups::vehicle_command>(cmd_msg);

}

void jaiabot::apps::BotPidControl::handle_command(const Command& command)
{
    glog.is_debug1() && glog << "Received command: " << command.ShortDebugString() << std::endl;

    if (command.has_rudder()) {
        rudder = command.rudder();
        rudder_is_using_pid = false;
    }
    else if (command.has_heading()) {
        auto heading = command.heading();
        rudder_is_using_pid = true;

        if (heading.has_target()) {
            target_heading = heading.target();
        }

        bool gains_changed = false;

        if (heading.has_kp())
        {
            kp = heading.kp();
            gains_changed = true;
        }

        if (heading.has_ki())
        {
            ki = heading.ki();
            gains_changed = true;
        }

        if (heading.has_kd())
        {
            kd = heading.kd();
            gains_changed = true;
        }

        if (gains_changed)
        {
            delete course_pid;
            course_pid = new Pid(&actual_heading, &rudder, &target_heading, kp, ki, kd);
            course_pid->set_auto();
        }

    }

}

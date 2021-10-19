// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/helm.pb.h"
#include "jaiabot/messages/low_control.pb.h"

#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include "PID/PID.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
class PIDControl : public zeromq::MultiThreadApplication<config::PIDControl>
{
  public:
    PIDControl();
    ~PIDControl();

  private:
    float in, out, set;
    float kp = 1, ki = 1, kd = 1;

    // Course targeting
    float course = 0.0;
    float track = 0.0;
    float rudder = 0.0;
    Pid *course_pid;

    void loop() override;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::PIDControl>(
        goby::middleware::ProtobufConfigurator<config::PIDControl>(argc, argv));
}

// Main thread

jaiabot::apps::PIDControl::PIDControl()
    : zeromq::MultiThreadApplication<config::PIDControl>(1.0 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    course_pid = new Pid(&track, &rudder, &course, kp, ki, kd);
    course_pid->set_auto();

    // Subscribe to Helm messages
    interprocess().subscribe<groups::helm>(
        [this](const jaiabot::protobuf::Helm& helm) {
        glog.is_debug1() && glog << "Received helm command: " << helm.ShortDebugString() << std::endl;

        course = helm.course();

        bool gains_changed = false;

        if (helm.has_course_kp()) {
            kp = helm.course_kp();
            gains_changed = true;
        }

        if (helm.has_course_ki()) {
            ki = helm.course_ki();
            gains_changed = true;
        }

        if (helm.has_course_kd()) {
            kd = helm.course_kd();
            gains_changed = true;
        }

        if (gains_changed) {
            delete course_pid;
            course_pid = new Pid(&track, &rudder, &course, kp, ki, kd);
            course_pid->set_auto();
        }
        });

    // Subscribe to get actual vehicle track
    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
        if (tpv.has_track()) {
            track = tpv.track();
            glog.is_debug1() && glog << "Actual track: " << track << std::endl;
        }
        });

}

jaiabot::apps::PIDControl::~PIDControl() {
    delete course_pid;
}


void jaiabot::apps::PIDControl::loop() {

    // Make sure track is within 180 degrees of the course
    if (track > course + 180.0) {
        track -= 360.0;
    }
    if (track < course - 180.0) {
        track += 360.0;
    }

    // Compute new rudder value
    if (course_pid->need_compute()) {
        course_pid->compute();
    }

    glog.is_debug1() && glog << group("main") << "course = " << course << ", track = " << track << ", value = " << rudder << std::endl;

    // Publish the ControlCommand

    jaiabot::protobuf::ControlCommand cmd_msg;

    auto& cmd = *cmd_msg.mutable_command();

    static std::atomic<int> id(0);

    cmd_msg.set_id(id++);
    cmd_msg.set_vehicle(1); // Set this to correct value?
    cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    cmd.set_timeout(2);
    cmd.set_port_elevator(0);
    cmd.set_stbd_elevator(0);
    cmd.set_rudder(rudder);
    cmd.set_motor(0);

    interprocess().publish<groups::control_command>(cmd_msg);

}

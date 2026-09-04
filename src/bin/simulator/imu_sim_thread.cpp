// Copyright 2026:
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

#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/simulator.pb.h"

#include "imu_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;

jaiabot::apps::IMUSimThread::IMUSimThread(const jaiabot::config::IMUSimThread& cfg)
    : SimulatorThread<jaiabot::config::IMUSimThread>(cfg, "imu_simulator",
                                                     0 * boost::units::si::hertz)
{
    glog.add_group("imu", goby::util::Colors::magenta);

    interthread().subscribe<sim_nav>([this](const SimNav& nav) { handle_sim_nav(nav); });
}

void jaiabot::apps::IMUSimThread::handle_sim_nav(const SimNav& nav)
{
    // publish IMUData
    jaiabot::protobuf::IMUData imu_data;

    imu_data.mutable_euler_angles()->set_pitch_with_units(nav.pitch);
    imu_data.mutable_euler_angles()->set_roll_with_units(nav.roll);

    auto accuracies = imu_data.mutable_accuracies();
    accuracies->set_accelerometer(3);
    accuracies->set_gyroscope(3);
    accuracies->set_magnetometer(3);

    glog.is_debug1() && glog << group("imu") << imu_data.ShortDebugString() << std::endl;

    interprocess().publish<groups::imu>(imu_data);
}

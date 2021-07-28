// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Edited by Ed Sanville <edsanville@gmail.com>
//
//
// This file is part of the JaiaBot Hydro Project Binaries
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

#include <numeric>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <dccl/codec.h>
#include <goby/util/constants.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group imu{"imu"};

namespace jaiabot
{
namespace apps
{
class IMUSubscriber : public zeromq::MultiThreadApplication<config::IMUSubscriber>
{
  public:
    IMUSubscriber();

  private:
    void loop() override;

  private:
    dccl::Codec dccl_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::IMUSubscriber>(
        goby::middleware::ProtobufConfigurator<config::IMUSubscriber>(argc, argv));
}

// Main thread

double loop_freq = 0;

jaiabot::apps::IMUSubscriber::IMUSubscriber()
    : zeromq::MultiThreadApplication<config::IMUSubscriber>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    interprocess().subscribe<imu>([this](const protobuf::IMUData& data) {
      glog.is_verbose() && glog << group("main") << "Euler angles:  (" << data.euler_angles().alpha() << ", " << data.euler_angles().beta() << ", " << data.euler_angles().gamma() << ")" << std::endl;
      glog.is_verbose() && glog << group("main") << "Linear Accel:  (" << data.linear_acceleration().x() << ", " << data.linear_acceleration().y() << ", " << data.linear_acceleration().z() << ")" << std::endl;
      glog.is_verbose() && glog << group("main") << "Gravity     :  (" << data.gravity().x() << ", " << data.gravity().y() << ", " << data.gravity().z() << ")" << std::endl;
    });
}

void jaiabot::apps::IMUSubscriber::loop()
{
}

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
#include <goby/middleware/io/udp_point_to_point.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/imu.pb.h"

using goby::glog;
using namespace std;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

namespace jaiabot
{
namespace apps
{
constexpr goby::middleware::Group imu_udp_in{"imu_udp_in"};
constexpr goby::middleware::Group imu_udp_out{"imu_udp_out"};

class AdaFruitBNO055Publisher : public zeromq::MultiThreadApplication<config::AdaFruitBNO055Publisher>
{
  public:
    AdaFruitBNO055Publisher();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

  private:
    dccl::Codec dccl_;
    goby::time::SteadyClock::time_point last_adafruit_BNO055_report_time_{std::chrono::seconds(0)};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::AdaFruitBNO055Publisher>(
        goby::middleware::ProtobufConfigurator<config::AdaFruitBNO055Publisher>(argc, argv));
}

// Main thread

double loop_freq = 1;


// for string delimiter
std::vector<std::string> split (std::string s, std::string delimiter) {
    size_t pos_start = 0, pos_end, delim_len = delimiter.length();
    std::string token;
    std::vector<std::string> res;

    while ((pos_end = s.find (delimiter, pos_start)) != std::string::npos) {
        token = s.substr (pos_start, pos_end - pos_start);
        pos_start = pos_end + delim_len;
        res.push_back (token);
    }

    res.push_back (s.substr (pos_start));
    return res;
}


jaiabot::apps::AdaFruitBNO055Publisher::AdaFruitBNO055Publisher()
    : zeromq::MultiThreadApplication<config::AdaFruitBNO055Publisher>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<imu_udp_in, imu_udp_out>;
    launch_thread<GPSUDPThread>(cfg().udp_config());

    interprocess().subscribe<imu_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
      auto s = std::string(data.data());
      auto fields = split(s, ",");
      if (fields.size() < 10) {
        glog.is_warn() && glog << group("main") << "Did not receive enough fields: " << s << std::endl;
        return;
      }

      int index = 0;
      
      auto date_string = fields[index++];

      jaiabot::protobuf::IMUData output;

      output.mutable_euler_angles()->set_alpha(std::stod(fields[index++]));
      output.mutable_euler_angles()->set_beta(std::stod(fields[index++]));
      output.mutable_euler_angles()->set_gamma(std::stod(fields[index++]));

      output.mutable_linear_acceleration()->set_x(std::stod(fields[index++]));
      output.mutable_linear_acceleration()->set_y(std::stod(fields[index++]));
      output.mutable_linear_acceleration()->set_z(std::stod(fields[index++]));

      output.mutable_gravity()->set_x(std::stod(fields[index++]));
      output.mutable_gravity()->set_y(std::stod(fields[index++]));
      output.mutable_gravity()->set_z(std::stod(fields[index++]));

      glog.is_debug1() && glog << "Publishing IMU data: " << output.ShortDebugString() << endl;

      interprocess().publish<groups::imu>(output);
      last_adafruit_BNO055_report_time_ = goby::time::SteadyClock::now();

    });

}

void jaiabot::apps::AdaFruitBNO055Publisher::loop()
{
    // Just send an empty packet
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<imu_udp_out>(io_data);
}

void jaiabot::apps::AdaFruitBNO055Publisher::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the adafruit_BNO055 is responding
    if (last_adafruit_BNO055_report_time_ +
            std::chrono::seconds(cfg().adafruit_bno055_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on adafruit_BNO055" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__FAILED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_ADAFRUIT_BNO055_DRIVER);
    }

    health.set_state(health_state);
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
}

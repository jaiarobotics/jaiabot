// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Matthew Ferro <matt.ferro@jaia.tech>
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
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/util/constants.h>
#include <goby/zeromq/application/multi_thread.h>
#include <iostream>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/echo.pb.h"
#include "jaiabot/messages/health.pb.h"

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
constexpr goby::middleware::Group echo_udp_in{"echo_udp_in"};
constexpr goby::middleware::Group echo_udp_out{"echo_udp_out"};

class EchoDriver : public zeromq::MultiThreadApplication<config::EchoDriver>
{
  public:
    EchoDriver();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    goby::time::SteadyClock::time_point last_echo_report_time_{std::chrono::seconds(0)};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::EchoDriver>(
        goby::middleware::ProtobufConfigurator<config::EchoDriver>(argc, argv));
}

// Main thread

double loop_freq = 1;

jaiabot::apps::EchoDriver::EchoDriver()
    : zeromq::MultiThreadApplication<config::EchoDriver>(loop_freq * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using GPSUDPThread = goby::middleware::io::UDPPointToPointThread<echo_udp_in, echo_udp_out>;
    launch_thread<GPSUDPThread>(cfg().udp_config());

    interthread().subscribe<echo_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
        // Deserialize from the UDP packet
        jaiabot::protobuf::EchoData echo_data;
        if (!echo_data.ParseFromString(data.data()))
        {
            glog.is_warn() && glog << "Couldn't deserialize EchoData from the UDP packet" << endl;
            return;
        }

        glog.is_debug2() && glog << "Publishing Echo data: " << echo_data.ShortDebugString()
                                 << endl;

        interprocess().publish<groups::echo>(echo_data);
        last_echo_report_time_ = goby::time::SteadyClock::now();
    });

    interprocess().subscribe<jaiabot::groups::echo>(
        [this](const protobuf::EchoCommand& echo_command) {
            auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
            io_data->set_data(echo_command.SerializeAsString());
            interthread().publish<echo_udp_out>(io_data);

            glog.is_debug1() && glog << "Sending EchoCommand: " << echo_command.ShortDebugString()
                                     << endl;
        });
}

void jaiabot::apps::EchoDriver::loop()
{
    // Just send an empty packet
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    auto command = jaiabot::protobuf::EchoCommand();
    command.set_type(jaiabot::protobuf::EchoCommand::TAKE_READING);

    io_data->set_data(command.SerializeAsString());
    interthread().publish<echo_udp_out>(io_data);

    glog.is_debug2() && glog << "Requesting IMUData from python driver" << endl;
}

void jaiabot::apps::EchoDriver::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    //Check to see if the echo is responding
    if (!cfg().echo_report_in_simulation())
    {
        check_last_report(health, health_state);
    }

    health.set_state(health_state);
}

void jaiabot::apps::EchoDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_echo_report_time_ + std::chrono::seconds(cfg().echo_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on adafruit_BNO085" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__NOT_RESPONDING__JAIABOT_ECHO_DRIVER);
    }
}

// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Nick Marshall <nick.marshall@jaia.tech>
//   Michael Twomey <michael.twomey@jaia.tech>
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
#include <boost/units/absolute.hpp>
#include <boost/units/io.hpp>
#include <boost/units/systems/temperature/celsius.hpp>
#include <dccl/codec.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/util/constants.h>
#include <goby/util/seawater/units.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/moos.pb.h"
#include "jaiabot/messages/tsys01.pb.h"

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
constexpr goby::middleware::Group tsys01_udp_in{"tsys01_udp_in"};
constexpr goby::middleware::Group tsys01_udp_out{"tsys01_udp_out"};

class TSYS01TemperatureSensorDriver
    : public zeromq::MultiThreadApplication<config::TSYS01TemperatureSensorDriver>
{
  public:
    TSYS01TemperatureSensorDriver();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    dccl::Codec dccl_;
    goby::time::SteadyClock::time_point last_tsys01_report_time_{std::chrono::seconds(0)};
    bool helm_ivp_in_mission_{false};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::TSYS01TemperatureSensorDriver>(
        goby::middleware::ProtobufConfigurator<config::TSYS01TemperatureSensorDriver>(argc, argv));
}

// Main thread

jaiabot::apps::TSYS01TemperatureSensorDriver::TSYS01TemperatureSensorDriver()
    : zeromq::MultiThreadApplication<config::TSYS01TemperatureSensorDriver>(10 * si::hertz)
{
    using TSYS01UDPThread =
        goby::middleware::io::UDPPointToPointThread<tsys01_udp_in, tsys01_udp_out>;
    launch_thread<TSYS01UDPThread>(cfg().udp_config());

    interthread().subscribe<tsys01_udp_in>([this](const goby::middleware::protobuf::IOData& data) {
        jaiabot::protobuf::TSYS01Data tsys01_data;
        if (!tsys01_data.ParseFromString(data.data()))
        {
            glog.is_warn() && glog << "Couldn't deserialize TSYS01Data from UDP packet"
                                   << std::endl;
            return;
        }

        glog.is_debug2() && glog << "Publishing TSYS01Data: " << tsys01_data.ShortDebugString()
                                 << std::endl;

        interprocess().publish<groups::tsys01>(tsys01_data);
        last_tsys01_report_time_ = goby::time::SteadyClock::now();
    });

    interprocess().subscribe<jaiabot::groups::moos>([this](const protobuf::MOOSMessage& moos_msg) {
        if (moos_msg.key() == "JAIABOT_MISSION_STATE")
        {
            if (moos_msg.svalue() == "IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT")
            {
                helm_ivp_in_mission_ = true;
            }
            else
            {
                helm_ivp_in_mission_ = false;
            }
        }
    });
}

void jaiabot::apps::TSYS01TemperatureSensorDriver::loop()
{
    // Just send an empty packet to provide the python driver with a return address
    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    io_data->set_data("hello\n");
    interthread().publish<tsys01_udp_out>(io_data);
}

void jaiabot::apps::TSYS01TemperatureSensorDriver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    check_last_report(health, health_state);

    health.set_state(health_state);
}

void jaiabot::apps::TSYS01TemperatureSensorDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_tsys01_report_time_ +
            std::chrono::seconds(cfg().tsys01_temperature_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on TSYS01 temperature sensor" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER);
    }
}

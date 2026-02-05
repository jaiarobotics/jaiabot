// Copyright 2025:
//   JaiaRobotics LLC
// File authors:
//   Matthew Ferro <matt.ferro@jaia.tech>
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
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/sensor/turner__c_fluor.pb.h"
#include "jaiabot/messages/arduino.pb.h"

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

class AMLSensorDriver
    : public zeromq::MultiThreadApplication<config::AMLSensorDriver>
{
  public:
    AMLSensorDriver();

  private:
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    goby::time::SteadyClock::time_point last_aml_report_time_{std::chrono::seconds(0)};
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::AMLSensorDriver>(
        goby::middleware::ProtobufConfigurator<config::AMLSensorDriver>(argc, argv));
}

jaiabot::apps::AMLSensorDriver::AMLSensorDriver()
    : zeromq::MultiThreadApplication<config::AMLSensorDriver>()
{
  using SerialThread = goby::middleware::io::SerialThreadLineBased<jaiabot::groups::aml_in,
                                                                   jaiabot::groups::aml_out>;
  launch_thread<SerialTHread>(cfg().serial());
}

void jaiabot::apps::AMLSensorDriver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    check_last_report(health, health_state);

    health.set_state(health_state);
}

void jaiabot::apps::AMLSensorDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_aml_report_time_ +
            std::chrono::seconds(cfg().aml_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on AML sensor" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__MISSING_DATA__AML_DATA);
    }
}

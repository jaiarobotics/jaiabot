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

class TurnerCFluorSensorDriver
    : public zeromq::MultiThreadApplication<config::TurnerCFluorSensorDriver>
{
  public:
    TurnerCFluorSensorDriver();

  private:
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);

  private:
    goby::time::SteadyClock::time_point last_turner_c_fluor_report_time_{std::chrono::seconds(0)};
    jaiabot::sensor::protobuf::FluorCoefficients fcoefficients_;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::TurnerCFluorSensorDriver>(
        goby::middleware::ProtobufConfigurator<config::TurnerCFluorSensorDriver>(argc, argv));
}

jaiabot::apps::TurnerCFluorSensorDriver::TurnerCFluorSensorDriver()
    : zeromq::MultiThreadApplication<config::TurnerCFluorSensorDriver>()
{
    interprocess().subscribe<jaiabot::groups::arduino_to_pi>(
        [this](const jaiabot::protobuf::ArduinoResponse& arduino_response) {

        jaiabot::sensor::protobuf::TurnerCFluor turner_c_fluor_msg;

        // this driver reads a single fluorometer off the Arduino analog pin
        turner_c_fluor_msg.set_instance(jaiabot::sensor::protobuf::INSTANCE_1);

        if (arduino_response.has_generic_gpio_voltage())
        {
            turner_c_fluor_msg.set_concentration_voltage(arduino_response.generic_gpio_voltage());

            // Fluorometer coefficients
            if (cfg().has_fluorometer_coefficients())
            {
                fcoefficients_ = cfg().fluorometer_coefficients();
                double concentration = (turner_c_fluor_msg.concentration_voltage() - fcoefficients_.offset()) * fcoefficients_.coefficient();
                turner_c_fluor_msg.set_concentration(concentration);

                if (fcoefficients_.has_analyte())
                {
                    turner_c_fluor_msg.set_analyte(fcoefficients_.analyte());
                }

                if (fcoefficients_.has_units())
                {
                    turner_c_fluor_msg.set_units(fcoefficients_.units());
                }
            }
        }

        glog.is_debug2() && glog << "Publishing Turner C Fluor data: " << turner_c_fluor_msg.ShortDebugString()
                                 << std::endl;

        interprocess().publish<jaiabot::groups::fluorometer>(turner_c_fluor_msg);
        last_turner_c_fluor_report_time_ = goby::time::SteadyClock::now();
    });
}

void jaiabot::apps::TurnerCFluorSensorDriver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    check_last_report(health, health_state);

    health.set_state(health_state);
}

void jaiabot::apps::TurnerCFluorSensorDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    if (last_turner_c_fluor_report_time_ +
            std::chrono::seconds(cfg().turner_c_fluor_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on Turner C Fluor sensor" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__MISSING_DATA__TURNER_C_FLUOR_DATA);
    }
}

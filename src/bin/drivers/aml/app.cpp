// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
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
#include <string>
#include <iostream>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/multi_thread.h>
#include <goby/middleware/io/line_based/serial.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/sensor/aml.pb.h"

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
    void get_sensor_version();
    void set_output_rate();
    void handle_sensor_output(const goby::middleware::protobuf::IOData& io_data);
    
    jaiabot::sensor::protobuf::AML::Sensor sensor_name_{jaiabot::sensor::protobuf::AML::DEFAULT};

  private:
    goby::time::SteadyClock::time_point last_aml_report_time_{std::chrono::seconds(0)};
    bool received_aml_reading_{false};
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
  launch_thread<SerialThread>(cfg().serial());

  interthread().subscribe<jaiabot::groups::aml_in>(
    [this](const goby::middleware::protobuf::IOData& data) { handle_sensor_output(data); });

  get_sensor_version();
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
    // If AML has timed out AND we have received a reading before, HEALTH__DEGRADED
    if (last_aml_report_time_ +
            std::chrono::seconds(cfg().aml_report_timeout_seconds()) <
        goby::time::SteadyClock::now() && received_aml_reading_)
    {
        glog.is_warn() && glog << "Timeout on AML sensor" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(
                protobuf::WARNING__MISSING_DATA__AML_DATA);
    }
}

void jaiabot::apps::AMLSensorDriver::get_sensor_version()
{
  goby::middleware::protobuf::IOData io_out;
  io_out.set_data("\r\nDISPLAY VERSION\r\n");
  interthread().publish<jaiabot::groups::aml_out>(io_out);
}

void jaiabot::apps::AMLSensorDriver::set_output_rate()
{
    goby::middleware::protobuf::IOData io_out;
    std::string output_rate_cmd = "\r\nSET OUTPUTRATE " + std::to_string(cfg().output_rate()) + "\r\n"; 
    io_out.set_data(output_rate_cmd);
    interthread().publish<jaiabot::groups::aml_out>(io_out);
}

void jaiabot::apps::AMLSensorDriver::handle_sensor_output(const goby::middleware::protobuf::IOData& io_data)
{
    last_aml_report_time_ = goby::time::SteadyClock::now();

    if (sensor_name_ == jaiabot::sensor::protobuf::AML::DEFAULT)
    {
        if (io_data.data().contains(cfg().catalog().conductivity()))
        {
            sensor_name_ = jaiabot::sensor::protobuf::AML::CONDUCTIVITY;
        }
    }

    jaiabot::sensor::protobuf::AML aml;
    std::istringstream input_stream{io_data.data()};
    switch (sensor_name_)
    {
        case jaiabot::sensor::protobuf::AML::DEFAULT: break;

        case jaiabot::sensor::protobuf::AML::CONDUCTIVITY:
            double conductivity{};
            double temperature{};
            if (input_stream >> conductivity >> temperature) 
            {
                aml.set_conductivity(conductivity);
                aml.set_temperature(temperature);
            }
            else
            {
                glog.is_debug1() && glog << "Unexpected CT sensor output" << std::endl;
            }
            break;
    }
    aml.set_sensor(sensor_name_);
    interprocess().publish<jaiabot::groups::aml>(aml);
    received_aml_reading_ = true;
}

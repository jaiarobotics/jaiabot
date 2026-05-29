// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Michael Twomey <michael.twomey@jaia.tech>
//   Nick Marshall <nick.marshall@jaia.tech>
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
#include <goby/middleware/application/simple_thread.h>

#include "config.pb.h"
#include "aml.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/sensor/aml.pb.h"

using goby::glog;

jaiabot::apps::AMLSensorDriver::AMLSensorDriver(const jaiabot::config::AMLThreadConfig& config)
    : goby::zeromq::SimpleThread<jaiabot::config::AMLThreadConfig>(config)
{
  glog.add_group("aml", goby::util::Colors::blue);

  interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
    [this](const sensor::protobuf::SensorData& sensor_data) { 
        if (sensor_data.has_aml())
            receive_data(sensor_data.aml());
    });

  // get_sensor_version();

  // Set sample rate config
  sample_rate_ = config.sample_rate();

  // Set report timeout on missing report
  report_timeout_ = config.report_timeout_seconds();
  resend_cfg_timeout_ = config.resend_cfg_timeout_seconds(); 

  // Configure the sensor
  send_cfg();
}

void jaiabot::apps::AMLSensorDriver::receive_data(
    const sensor::protobuf::AML& aml_data)
{
    glog.is_debug1() && glog << group("aml_sensor")
                            << "Received aml_data: " << aml_data.ShortDebugString()
                            << std::endl;

    jaiabot::sensor::protobuf::AML aml;
    if (aml_data.has_sensor())
    {
        aml.set_sensor(aml_data.sensor());
    }

    if (aml_data.has_conductivity())
    {
        aml.set_conductivity(aml_data.conductivity());
    }

    if (aml_data.has_temperature())
    {
        aml.set_temperature(aml_data.temperature());
    }

    interprocess().publish<jaiabot::groups::aml>(aml);

    last_report_time_ = goby::time::SteadyClock::now();
    received_aml_reading_ = true;
}

void jaiabot::apps::AMLSensorDriver::send_cfg() 
{
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(jaiabot::sensor::protobuf::AML__SENSOR);

    sensor_cfg.set_sample_freq_with_units(sample_rate_ * boost::units::si::hertz);
    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

// If AML has timed out AND we have received a reading before, HEALTH__DEGRADED
void jaiabot::apps::AMLSensorDriver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_report_time_ + std::chrono::seconds(report_timeout_) < goby::time::SteadyClock::now() && received_aml_reading_)
    {
        glog.is_warn() && glog << "Timeout on AML report" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(jaiabot::protobuf::WARNING__MISSING_DATA__AML_DATA);

        // Send configuration request at a configured rate
        if (last_resend_cfg_time_ + std::chrono::seconds(resend_cfg_timeout_) <
            goby::time::SteadyClock::now())
        {
            send_cfg();
            last_resend_cfg_time_ = goby::time::SteadyClock::now();
        }
    }

    health.set_state(health_state);
}
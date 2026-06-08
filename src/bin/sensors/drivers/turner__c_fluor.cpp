// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Matthew Ferro <matt.ferro@jaia.tech>
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

#include <fstream>
#include <goby/time/system_clock.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/sensor/configuration.pb.h"
#include "turner__c_fluor.h"
#include <google/protobuf/text_format.h>

using goby::glog;

jaiabot::apps::TurnerCFluorDriver::TurnerCFluorDriver(
    const jaiabot::config::TurnerCFluorThreadConfig& config)
    : goby::zeromq::SimpleThread<jaiabot::config::TurnerCFluorThreadConfig>(config)
{
    glog.add_group("turner_c_fluor", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data) {
            if (sensor_data.has_c_fluor())
                receive_data(sensor_data.c_fluor());
        });

    // Set sample rate config
    sample_rate_ = config.sample_rate();

    // Set timeout on missing report
    report_timeout_ = config.report_timeout_seconds();
    resend_cfg_timeout_ = config.resend_cfg_timeout_seconds();

    // Fluorometer coefficients
    if (config.has_fluorometer_coefficients())
    {
        fluorometer_coefficients_ = config.fluorometer_coefficients();
    }

    // Configure our sensor
    send_cfg();
}

void jaiabot::apps::TurnerCFluorDriver::receive_data(
    const sensor::protobuf::TurnerCFluor& turner_c_fluor_data)
{
    glog.is_debug1() && glog << group("turner_c_fluor") << "Received turner_c_fluor_data: "
                             << turner_c_fluor_data.ShortDebugString() << std::endl;

    jaiabot::sensor::protobuf::TurnerCFluor turner_c_fluor_msg;
    if (turner_c_fluor_data.has_concentration())
    {
        turner_c_fluor_msg.set_concentration(turner_c_fluor_data.concentration());
    }
    if (turner_c_fluor_data.has_concentration_voltage())
    {
        turner_c_fluor_msg.set_concentration_voltage(turner_c_fluor_data.concentration_voltage());
    }
    interprocess().publish<jaiabot::groups::fluorometer>(turner_c_fluor_msg);

    last_report_time_ = goby::time::SteadyClock::now();

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA threadcd
}

void jaiabot::apps::TurnerCFluorDriver::send_cfg()
{
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(jaiabot::sensor::protobuf::TURNER__C_FLUOR);

    sensor_cfg.set_sample_freq_with_units(sample_rate_ * boost::units::si::hertz);

    if (fluorometer_coefficients_.has_offset())
    {
        auto* cal_offset = sensor_cfg.add_cfg();
        cal_offset->set_key("offset");
        cal_offset->set_value(std::to_string(fluorometer_coefficients_.offset()));
    }

    if (fluorometer_coefficients_.has_coefficient())
    {
        auto* cal_offset = sensor_cfg.add_cfg();
        cal_offset->set_key("coefficient");
        cal_offset->set_value(std::to_string(fluorometer_coefficients_.coefficient()));
    }

    if (fluorometer_coefficients_.has_serial_number())
    {
        auto* cal_offset = sensor_cfg.add_cfg();
        cal_offset->set_key("serial_number");
        cal_offset->set_value(std::to_string(fluorometer_coefficients_.serial_number()));
    }

    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

void jaiabot::apps::TurnerCFluorDriver::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_report_time_ + std::chrono::seconds(report_timeout_) < goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on turner c fluorometer report" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__MISSING_DATA__TURNER_C_FLUOR_DATA);

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

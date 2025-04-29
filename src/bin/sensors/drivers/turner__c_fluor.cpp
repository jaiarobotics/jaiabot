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

#include <goby/time/system_clock.h>
#include <fstream>

#include <google/protobuf/text_format.h>
#include "jaiabot/groups.h"
#include "jaiabot/messages/calibration_coefficients.pb.h"
#include "jaiabot/messages/sensor/configuration.pb.h"
#include "turner__c_fluor.h"

using goby::glog;

jaiabot::apps::TurnerCFluorDriver::TurnerCFluorDriver(
    const jaiabot::config::TurnerCFluorThreadConfig& config)
    : goby::middleware::SimpleThread<jaiabot::config::TurnerCFluorThreadConfig>(config)
{
    glog.add_group("turner_c_fluor", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>( 
        [this](const sensor::protobuf::SensorData& sensor_data) {
            if (sensor_data.has_c_fluor())
                receive_data(sensor_data.c_fluor());
        });

    interthread().subscribe<jaiabot::groups::mcu_pb_data_out>(
        [this](const sensor::protobuf::SensorRequest& sensor_request) {
            glog.is_debug1() && glog << "Received sensor request" << std::endl;
            if (sensor_request.has_cfg() && sensor_request.cfg().cfg_count() > 0) {
                glog.is_debug1() && glog << "Received sensor request with cfg" << std::endl;
                receive_cfg(sensor_request.cfg());
            }
        });

    // Set sample rate config
    sample_rate_ = config.sample_rate();

    // Set timeout on missing report
    report_timeout_ = config.report_timeout_seconds();
    resend_cfg_timeout_ = config.resend_cfg_timeout_seconds();

    // configure our sensor
    send_cfg();
}

void jaiabot::apps::TurnerCFluorDriver::receive_cfg(
    const sensor::protobuf::Configuration& cfg)
{
    glog.is_debug1() && glog << "Fluorometer config changed: " << cfg.ShortDebugString() << std::endl;

    auto existing_fluoro_cfg = jaiabot::sensor::protobuf::Configuration();

    // Fluorometer calibration coefficients from /etc/jaiabot/calibration_coefficients.pb.cfg
    auto existing_fluoro_cfg_file = std::ifstream("/etc/jaiabot/fluorometer_config.pb.cfg");
    
    if (existing_fluoro_cfg_file.fail())
    {
        glog.is_warn() && glog << "Couldn't open file: /etc/jaiabot/fluorometer_config.pb.cfg" << std::endl;
    }
    else
    {
        std::stringstream existing_fluoro_cfg_stringstream;
        existing_fluoro_cfg_stringstream << existing_fluoro_cfg_file.rdbuf();

        if (!google::protobuf::TextFormat::ParseFromString(existing_fluoro_cfg_stringstream.str(),
                                                           &existing_fluoro_cfg))
        {
            glog.is_warn() && glog << "Couldn't parse existing file: /etc/jaiabot/calibration_coefficients.pb.cfg"
                                   << std::endl;
        }
    }

    auto fluoro_cfg = jaiabot::sensor::protobuf::Configuration();
    fluoro_cfg.CopyFrom(existing_fluoro_cfg);
    fluoro_cfg.MergeFrom(cfg);

    auto cfg_file = std::ofstream("/etc/jaiabot/fluorometer_config.pb.cfg");
    cfg_file << fluoro_cfg.DebugString();
    cfg_file.close();
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
    
    auto existing_calibration = jaiabot::protobuf::CalibrationCoefficients();

    // Fluorometer calibration coefficients from /etc/jaiabot/calibration_coefficients.pb.cfg
    auto existing_calibration_file = std::ifstream("/etc/jaiabot/calibration_coefficients.pb.cfg");
    
    if (existing_calibration_file.fail())
    {
        glog.is_warn() && glog << "Couldn't open file: /etc/jaiabot/calibration_coefficients.pb.cfg" << std::endl;
    }
    else
    { 
        std::stringstream existing_calibration_stringstream;
        existing_calibration_stringstream << existing_calibration_file.rdbuf();

        if (!google::protobuf::TextFormat::ParseFromString(existing_calibration_stringstream.str(),
                                                           &existing_calibration))
        {
            glog.is_warn() && glog << "Couldn't parse existing file: /etc/jaiabot/calibration_coefficients.pb.cfg"
                                   << std::endl;
        }
    }

    auto* cal_offset = sensor_cfg.add_cfg();
    cal_offset->set_key("fluorometer_offset");
    cal_offset->set_value(existing_calibration.fluorometer().fluorometer_offset());

    auto* cal_coefficient = sensor_cfg.add_cfg();
    cal_coefficient->set_key("fluorometer_calibration_coefficient");
    cal_coefficient->set_value(existing_calibration.fluorometer().fluorometer_calibration_coefficient());

    auto* fluorometer_sn = sensor_cfg.add_cfg();
    fluorometer_sn->set_key("fluorometer_serial_number");
    fluorometer_sn->set_value(existing_calibration.fluorometer().fluorometer_serial_number());

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

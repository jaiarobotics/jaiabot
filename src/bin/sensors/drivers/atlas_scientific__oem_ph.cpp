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

#include "atlas_scientific__oem_ph.h"
#include "jaiabot/groups.h"
#include "jaiabot/utils/ph_temperature_compensation.h"

using goby::glog;

jaiabot::apps::AtlasScientificOEMPHDriver::AtlasScientificOEMPHDriver(
    const jaiabot::config::AtlasOEMPHThreadConfig& config)
    : goby::zeromq::SimpleThread<jaiabot::config::AtlasOEMPHThreadConfig>(config)

{
    glog.add_group("oem_ph", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data) {
            if (sensor_data.has_oem_ph())
                receive_data(sensor_data.oem_ph());
        });

    // Set sample rate config
    sample_rate_ = config.sample_rate();

    // Set timeout on missing report
    report_timeout_ = config.report_timeout_seconds();
    resend_cfg_timeout_ = config.resend_cfg_timeout_seconds();

    // configure our sensor
    send_cfg();
}

void jaiabot::apps::AtlasScientificOEMPHDriver::receive_data(
    const sensor::protobuf::AtlasScientificOEMpH& ph_data)
{
    glog.is_debug1() && glog << group("oem_ph")
                             << "Received ph_data: " << ph_data.ShortDebugString() << std::endl;

    jaiabot::sensor::protobuf::AtlasScientificOEMpH ph_msg;

    if (ph_data.has_ph_raw())
    {
        ph_msg.set_ph_raw(ph_data.ph_raw());
    }
    if (ph_data.has_temperature())
    {
        ph_msg.set_temperature(ph_data.temperature());
    }
    if (ph_data.has_ph_raw() && ph_data.has_temperature())
    {
        const double ph = temperature_compensated_ph(ph_data.ph_raw(), ph_data.temperature());
        ph_msg.set_ph(ph);
    }
    if (ph_data.has_temperature_voltage())
    {
        ph_msg.set_temperature_voltage(ph_data.temperature_voltage());
    }
    interprocess().publish<jaiabot::groups::ph>(ph_msg);

    last_report_time_ = goby::time::SteadyClock::now();

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA thread
}

void jaiabot::apps::AtlasScientificOEMPHDriver::send_cfg()
{
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(jaiabot::sensor::protobuf::ATLAS_SCIENTIFIC__OEM_PH);

    sensor_cfg.set_sample_freq_with_units(sample_rate_ * boost::units::si::hertz);
    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

void jaiabot::apps::AtlasScientificOEMPHDriver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_report_time_ + std::chrono::seconds(report_timeout_) < goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on atlas oem ph report" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__MISSING_DATA__ATLAS_OEM_PH_DATA);

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

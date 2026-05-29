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

#include "atlas_scientific__oem_do.h"
#include "jaiabot/groups.h"
#include "jaiabot/utils/dissolved_oxygen_compensation.h"

using goby::glog;

jaiabot::apps::AtlasScientificOEMDODriver::AtlasScientificOEMDODriver(
    const jaiabot::config::AtlasOEMDOThreadConfig& config)
    : goby::zeromq::SimpleThread<jaiabot::config::AtlasOEMDOThreadConfig>(config)

{
    glog.add_group("oem_do", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data) {
            if (sensor_data.has_oem_do())
                receive_data(sensor_data.oem_do());
        });

    interprocess().subscribe<jaiabot::groups::salinity>(
        [this](const sensor::protobuf::AtlasScientificOEMEC& salinity_data) {
            last_salinity_reading_ = salinity_data;
        });

    // Set sample rate config
    sample_rate_ = config.sample_rate();

    // Set timeout on missing report
    report_timeout_ = config.report_timeout_seconds();
    resend_cfg_timeout_ = config.resend_cfg_timeout_seconds();

    // configure our sensor
    send_cfg();
}

void jaiabot::apps::AtlasScientificOEMDODriver::receive_data(
    const sensor::protobuf::AtlasScientificOEMDO& do_data)
{
    glog.is_debug1() && glog << group("oem_do")
                             << "Received do_data: " << do_data.ShortDebugString() << std::endl;

    jaiabot::sensor::protobuf::AtlasScientificOEMDO do_msg;
    if (do_data.has_do_raw())
    {
        do_msg.set_do_raw(do_data.do_raw());
    }
    if (do_data.has_temperature())
    {
        do_msg.set_temperature(do_data.temperature());
    }
    if (do_data.has_temperature_voltage())
    {
        do_msg.set_temperature_voltage(do_data.temperature_voltage());
    }

    if (last_salinity_reading_.has_salinity() && do_data.has_do_raw() && do_data.has_temperature())
    {
        glog.is_debug1() && glog << group("oem_do")
                                 << "Creating DO solubility/sat percent/normalized solubility"
                                 << std::endl;

        // DO Solubility (mg/L) at current temperature (C), salinity (ppt), and pressure (mmhg)
        double do_solubility = calculate_dissolved_oxygen_solubility(
            do_data.temperature(), last_salinity_reading_.salinity());
        // Measured DO / DO Solubility at current temperature (C), salinity (ppt), and pressure (mmhg)
        double do_saturation_percent =
            calculate_do_saturation_percent(do_data.do_raw(), do_solubility);
        // DO Solubility at 0 salinity (ppt), same temperature (C) and pressure (mmhg), scaled by observed saturation
        double do_normalized_solubility =
            calculate_dissolved_oxygen_solubility(do_data.temperature(), 0.0) *
            (do_saturation_percent / 100.0);

        do_msg.set_do_solubility(do_solubility);
        do_msg.set_do_saturation_percent(do_saturation_percent);
        do_msg.set_do_normalized_solubility(do_normalized_solubility);
    }
    interprocess().publish<jaiabot::groups::dissolved_oxygen>(do_msg);

    last_report_time_ = goby::time::SteadyClock::now();

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA thread
}

void jaiabot::apps::AtlasScientificOEMDODriver::send_cfg()
{
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(jaiabot::sensor::protobuf::ATLAS_SCIENTIFIC__OEM_DO);

    sensor_cfg.set_sample_freq_with_units(sample_rate_ * boost::units::si::hertz);
    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

void jaiabot::apps::AtlasScientificOEMDODriver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_report_time_ + std::chrono::seconds(report_timeout_) < goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on atlas oem do report" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__MISSING_DATA__ATLAS_OEM_DO_DATA);

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

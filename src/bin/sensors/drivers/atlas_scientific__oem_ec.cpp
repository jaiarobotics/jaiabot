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

#include "atlas_scientific__oem_ec.h"
#include "jaiabot/groups.h"
#include "jaiabot/utils/derived_salinity.h"
#include "jaiabot/utils/specific_conductivity.h"

using goby::glog;

jaiabot::apps::AtlasScientificOEMECDriver::AtlasScientificOEMECDriver(
    const jaiabot::config::AtlasOEMECThreadConfig& config)
    : goby::zeromq::SimpleThread<jaiabot::config::AtlasOEMECThreadConfig>(config)

{
    glog.add_group("oem_ec", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data) {
            if (sensor_data.has_oem_ec())
                receive_data(sensor_data.oem_ec());
            if (sensor_data.has_oem_ph())
                last_ph_data_ = sensor_data.oem_ph();
        });

    // subscribe for pressure adjusted measurements (pressure -> depth)
    interprocess().subscribe<jaiabot::groups::pressure_adjusted>(
        [this](const jaiabot::protobuf::PressureAdjustedData& pa) {
            last_pressure_adjusted_data_ = pa;
        });

    // Set sample rate config
    sample_rate_ = config.sample_rate();

    // Set timeout on missing report
    report_timeout_ = config.report_timeout_seconds();
    resend_cfg_timeout_ = config.resend_cfg_timeout_seconds();

    // configure our sensor
    send_cfg();
}

void jaiabot::apps::AtlasScientificOEMECDriver::receive_data(
    const sensor::protobuf::AtlasScientificOEMEC& ec_data)
{
    glog.is_debug1() && glog << group("oem_ec")
                             << "Received ec_data: " << ec_data.ShortDebugString() << std::endl;

    jaiabot::sensor::protobuf::AtlasScientificOEMEC ec_msg;
    if (ec_data.has_conductivity_raw())
    {
        ec_msg.set_conductivity_raw(ec_data.conductivity_raw());
    }
    if (ec_data.has_total_dissolved_solids())
    {
        ec_msg.set_total_dissolved_solids(ec_data.total_dissolved_solids());
    }
    if (ec_data.has_salinity_raw())
    {
        ec_msg.set_salinity_raw(ec_data.salinity_raw());
    }
    // Using do data temperature because the bar30 is not
    // reporting accurately enough embedded into the midbody
    if (last_ph_data_.has_temperature())
    {
        const double specific_conductivity =
            calculate_specific_conductivity(ec_msg.conductivity_raw(), last_ph_data_.temperature());
        ec_msg.set_conductivity(specific_conductivity);
    }
    if (last_ph_data_.has_temperature() && last_pressure_adjusted_data_.has_pressure_adjusted())
    {
        const double ATMOSPHERIC_PRESSURE_DECIBARS = 10.1325;
        const double salinity = calculate_derived_salinity(
            ec_msg.conductivity_raw(), last_ph_data_.temperature(),
            last_pressure_adjusted_data_.pressure_adjusted() + ATMOSPHERIC_PRESSURE_DECIBARS);
        ec_msg.set_salinity(salinity);
    }

    interprocess().publish<jaiabot::groups::salinity>(ec_msg);

    last_report_time_ = goby::time::SteadyClock::now();

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA thread
}

void jaiabot::apps::AtlasScientificOEMECDriver::send_cfg()
{
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(jaiabot::sensor::protobuf::ATLAS_SCIENTIFIC__OEM_EC);

    sensor_cfg.set_sample_freq_with_units(sample_rate_ * boost::units::si::hertz);
    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

void jaiabot::apps::AtlasScientificOEMECDriver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_report_time_ + std::chrono::seconds(report_timeout_) < goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on atlas oem ec report" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__DEGRADED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__MISSING_DATA__ATLAS_OEM_EC_DATA);

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

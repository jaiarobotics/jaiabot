// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
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

using goby::glog;

jaiabot::apps::AtlasScientificOEMPHDriver::AtlasScientificOEMPHDriver(
    const jaiabot::sensor::protobuf::SensorThreadConfig& config)
    : goby::middleware::SimpleThread<jaiabot::sensor::protobuf::SensorThreadConfig>(config)

{
    glog.add_group("oem_ph", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data)
        {
            if (sensor_data.has_oem_ph())
                receive_data(sensor_data.oem_ph());
        });

    // configure our sensor
    sensor::protobuf::SensorRequest request; 
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(config.metadata().sensor());

    // TODO - hardcode or configuration?
    sensor_cfg.set_sample_freq_with_units(config.sample_rate() * boost::units::si::hertz);
    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

void jaiabot::apps::AtlasScientificOEMPHDriver::receive_data(
    const sensor::protobuf::AtlasScientificOEMpH& ph_data)
{
    glog.is_debug1() && glog << group("oem_ph")
                             << "Received ph_data: " << ph_data.ShortDebugString() << std::endl;

    jaiabot::sensor::protobuf::AtlasScientificOEMpH ph_msg;

    if (ph_data.has_ph())
    {
        ph_msg.set_ph(ph_data.ph());
    }
    if (ph_data.has_temperature())
    {
        ph_msg.set_temperature(ph_data.temperature());
    }
    if (ph_data.has_temperature_voltage())
    {
        ph_msg.set_temperature_voltage(ph_data.temperature_voltage());
    }
    interprocess().publish<jaiabot::groups::ph>(ph_msg);

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA thread
}

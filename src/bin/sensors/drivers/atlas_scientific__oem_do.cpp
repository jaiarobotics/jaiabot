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

#include "atlas_scientific__oem_do.h"
#include "jaiabot/groups.h"

using goby::glog;

jaiabot::apps::AtlasScientificOEMDODriver::AtlasScientificOEMDODriver(
    const jaiabot::sensor::protobuf::SensorThreadConfig& config)
    : goby::middleware::SimpleThread<jaiabot::sensor::protobuf::SensorThreadConfig>(config)

{
    glog.add_group("oem_do", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data)
        {
            if (sensor_data.has_oem_do())
                receive_data(sensor_data.oem_do());
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

void jaiabot::apps::AtlasScientificOEMDODriver::receive_data(
    const sensor::protobuf::AtlasScientificOEMDO& do_data)
{
    glog.is_debug1() && glog << group("oem_do")
                             << "Received do_data: " << do_data.ShortDebugString() << std::endl;

    jaiabot::sensor::protobuf::AtlasScientificOEMDO do_msg;
    if (do_data.has_dissolved_oxygen())
    {
        do_msg.set_dissolved_oxygen(do_data.dissolved_oxygen());
    }
    if (do_data.has_temperature())
    {
        do_msg.set_temperature(do_data.temperature());
    }
    if (do_data.has_temperature_voltage())
    {
        do_msg.set_temperature_voltage(do_data.temperature_voltage());
    }
    interprocess().publish<jaiabot::groups::dissolved_oxygen>(do_msg);

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA thread
}

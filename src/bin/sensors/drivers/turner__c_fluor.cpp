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

#include "turner__c_fluor.h"

#include <goby/time/system_clock.h>
#include <goby/util/seawater/units.h>
#include "jaiabot/messages/sensor/turner__c_fluor.pb.h"

#include "jaiabot/groups.h"
#include "jaiabot/messages/sensor/sensor_core.pb.h"

using goby::glog;
namespace si = boost::units::si;

jaiabot::apps::TurnerCFluorDriver::TurnerCFluorDriver(
    const jaiabot::sensor::protobuf::Metadata& config)
    : goby::middleware::SimpleThread<jaiabot::sensor::protobuf::Metadata>(config)

{
    glog.add_group("turner_c_fluor", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data) {
            if (sensor_data.has_turner_c_fluor())
                receive_data(sensor_data.turner_c_fluor());
        });

    // configure our sensor
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(config.sensor());

    // TODO - hardcode or configuration?
    sensor_cfg.set_sample_freq_with_units(1 * boost::units::si::hertz);
    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

void jaiabot::apps::TurnerCFluorDriver::receive_data(
    const sensor::protobuf::TurnerCFluor& turner_c_fluor_data)
{
    glog.is_debug1() && glog << group("turner_c_fluor")
                             << "Received turner_c_fluor_data: " << turner_c_fluor_data.ShortDebugString()
                             << std::endl;

    jaiabot::protobuf::TurnerCFluorData turner_c_fluor_data;
    turner_c_fluor_data.set_sensor_type(jaiabot::protobuf::TURNER_C_FLUOR);

    if (turner_c_fluor_data.has_c_fluor())
    {
        turner_c_fluor_data.set_c_fluor_raw_with_units(turner_c_fluor_data.c_fluor());
    }

    interprocess().publish<jaiabot::groups::turner_c_fluor>(turner_c_fluor_data);

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA threadcd
}
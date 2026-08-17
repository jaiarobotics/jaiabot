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

#include "blue_robotics_bar30.h"

#include <boost/units/systems/temperature/celsius.hpp>
#include <goby/time/system_clock.h>
#include <goby/util/seawater/units.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/sensor/pressure_temperature.pb.h"

using goby::glog;
namespace si = boost::units::si;

jaiabot::apps::BlueRoboticsBar30Driver::BlueRoboticsBar30Driver(
    const jaiabot::config::BlueRoboticsBar30ThreadConfig& config)
    : goby::zeromq::SimpleThread<jaiabot::config::BlueRoboticsBar30ThreadConfig>(config)

{
    glog.add_group("bar30", goby::util::Colors::blue);

    interthread().subscribe<jaiabot::groups::mcu_pb_data_in>(
        [this](const sensor::protobuf::SensorData& sensor_data) {
            if (sensor_data.has_bar30())
                receive_data(sensor_data.bar30());
        });

    // Set sample rate config
    sample_rate_ = config.sample_rate();

    // Set timeout on missing report
    report_timeout_ = config.report_timeout_seconds();
    resend_cfg_timeout_ = config.resend_cfg_timeout_seconds();

    // configure our sensor
    send_cfg();
}

void jaiabot::apps::BlueRoboticsBar30Driver::receive_data(
    const sensor::protobuf::BlueRoboticsBar30& bar30_data)
{
    glog.is_debug1() && glog << group("bar30")
                             << "Received bar30_data: " << bar30_data.ShortDebugString()
                             << std::endl;

    jaiabot::protobuf::PressureTemperatureData pressure_temperature_data;
    pressure_temperature_data.set_sensor_type(jaiabot::protobuf::BAR30);

    if (bar30_data.has_pressure())
    {
        pressure_temperature_data.set_pressure_raw_with_units(bar30_data.pressure() * si::milli *
                                                              goby::util::seawater::bar);
    }

    if (bar30_data.has_temperature())
    {
        pressure_temperature_data.set_temperature_with_units(
            bar30_data.temperature() *
            boost::units::absolute<boost::units::celsius::temperature>());
    }

    interprocess().publish<jaiabot::groups::pressure_temperature>(pressure_temperature_data);

    last_report_time_ = goby::time::SteadyClock::now();

    // TODO - add calibration and metadata ID, convert to standardized message, and publish over to QA threadcd
}

void jaiabot::apps::BlueRoboticsBar30Driver::send_cfg()
{
    sensor::protobuf::SensorRequest request;
    request.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    auto& sensor_cfg = *request.mutable_cfg();
    sensor_cfg.set_sensor(jaiabot::sensor::protobuf::BLUE_ROBOTICS__BAR30);

    sensor_cfg.set_sample_freq_with_units(sample_rate_ * boost::units::si::hertz);
    interprocess().publish<jaiabot::groups::mcu_pb_data_out>(request);
}

void jaiabot::apps::BlueRoboticsBar30Driver::health(
    goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (last_report_time_ + std::chrono::seconds(report_timeout_) < goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on blue robotics bar30 report" << std::endl;
        health_state = goby::middleware::protobuf::HEALTH__FAILED;
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__MISSING_DATA__BLUEROBOTICS_BAR30_DATA);

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

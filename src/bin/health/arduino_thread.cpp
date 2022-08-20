// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Matt Ferro <matt.ferro@jaia.tech>
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

#include <boost/units/io.hpp>

#include "system_thread.h"

#include "jaiabot/groups.h"
#include "jaiabot/messages/arduino.pb.h"

using goby::glog;

jaiabot::apps::ArduinoStatusThread::ArduinoStatusThread(
    const jaiabot::config::ArduinoStatusConfig& cfg)
    : HealthMonitorThread(cfg, "arduino_status", 4.0 / 60.0 * boost::units::si::hertz)
{
    interprocess().subscribe<jaiabot::groups::arduino_to_pi>(
        [this](const jaiabot::protobuf::ArduinoResponse& arduino_response) {
            last_arduino_report_time_ = goby::time::SteadyClock::now();
            status_.set_code(arduino_response.status_code());
            status_.set_thermocouple_temperature(arduino_response.thermocouple_temperature_c());
            status_.set_vcccurrent(arduino_response.vcccurrent());
            status_.set_vccvoltage(arduino_response.vccvoltage());
            status_.set_vvcurrent(arduino_response.vvcurrent());
            status_.set_crc(arduino_response.crc());
            status_.set_calculated_crc(arduino_response.calculated_crc());
        });
}

void jaiabot::apps::ArduinoStatusThread::issue_status_summary()
{
    glog.is_debug2() && glog << group(thread_name()) << "Status: " << status_.DebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::arduino_to_pi>(status_);
    status_.Clear();
}

void jaiabot::apps::ArduinoStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    auto health_state = goby::middleware::protobuf::HEALTH__OK;
    //Check to see if the arduino is responding
    if (last_arduino_report_time_ + std::chrono::seconds(cfg().arduino_report_timeout_seconds()) <
        goby::time::SteadyClock::now())
    {
        glog.is_warn() && glog << "Timeout on arduino report" << std::endl;
        demote_health(health_state, goby::middleware::protobuf::HEALTH__FAILED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_DRIVER_ARDUINO);
    }

    health.set_state(health_state);
}

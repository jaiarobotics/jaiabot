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

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/arduino.pb.h"
#include "simulator_thread.h"

namespace si = boost::units::si;
using goby::glog;
using namespace std;

jaiabot::apps::ArduinoSimThread::ArduinoSimThread(const jaiabot::config::ArduinoSimThread& cfg)
    : SimulatorThread(cfg, "arduino_simulator", 1.0 * boost::units::si::hertz)
{
    voltage_step_decrease_ = cfg.voltage_step_decrease();
    voltage_period_ = cfg.voltage_period();
    voltage_start_ = cfg.voltage_start();
    reset_voltage_level_ = cfg.reset_voltage_level();

    interprocess().subscribe<groups::arduino_from_pi>(
        [this](const jaiabot::protobuf::ArduinoCommand& arduino_command) {
            handle_arduino_command(arduino_command);
        });

}


void jaiabot::apps::ArduinoSimThread::handle_arduino_command(const jaiabot::protobuf::ArduinoCommand& arduino_command)
{
    glog.is_debug2() && glog << group(thread_name()) << "Received Arduino Command: "
                            << arduino_command.ShortDebugString() << std::endl;

    // Publishing the ArduinoResponse messages to interprocess, allows the
    //   jaiabot_driver_arduino thread to subscribe to these messages and handle them 
    //   as if they were coming from the actual Arduino, which is useful for testing 
    //   the driver without needing the physical hardware.
    jaiabot::protobuf::ArduinoResponse arduino_response;
    arduino_response.set_version(3);
    arduino_response.set_thermistor_voltage(2.5);

    if (arduino_command.has_settings())
    {
        arduino_response.set_status_code(jaiabot::protobuf::ArduinoStatusCode::SETTINGS); 
    }

    else
    {
        arduino_response.set_status_code(jaiabot::protobuf::ArduinoStatusCode::ACK); 
    }

    auto now = goby::time::SteadyClock::now();


    if (arduino_command.has_actuators())
    {
        auto actuators = arduino_command.actuators();
        if (actuators.has_motor()) {
            arduino_response.set_motor(actuators.motor());
        }
    }

    // Simulate the voltage decreasing over time, and resetting when it gets too low
    if ((voltage_updated_ + std::chrono::seconds(voltage_period_)) < now)
    {
        voltage_start_ = voltage_start_ - voltage_step_decrease_;
        arduino_response.set_vccvoltage(voltage_start_);
        voltage_updated_ = goby::time::SteadyClock::now();

        if (voltage_start_ < reset_voltage_level_)
        {
            voltage_start_ = cfg().voltage_start();
        }
    }

    interprocess().publish<groups::arduino_to_pi>(arduino_response);
}


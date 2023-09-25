// Copyright 2021:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <algorithm>
#include <goby/zeromq/application/multi_thread.h>

using namespace std;

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/lora/serial.h"
#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/health.pb.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/low_control.pb.h"

#define now_microseconds() (goby::time::SystemClock::now<goby::time::MicroTime>().value())

using goby::glog;
using jaiabot::protobuf::ControlSurfaces;

namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group serial_in{"arduino::serial_in"};
constexpr goby::middleware::Group serial_out{"arduino::serial_out"};

namespace jaiabot
{
namespace apps
{
class ArduinoDriver : public zeromq::MultiThreadApplication<config::ArduinoDriverConfig>
{
  public:
    ArduinoDriver();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;
    void handle_control_surfaces(const ControlSurfaces& control_surfaces);
    int surfaceValueToMicroseconds(int input, int lower, int center, int upper);

    int64_t lastAckTime_;

    uint64_t _time_last_command_received_ = 0;
    const uint64_t timeout_ = 5e6;

    jaiabot::protobuf::Bounds bounds_;

    // Motor
    int target_motor_ = 1500;
    int max_reverse_ = 1320;

    // Control surfaces
    int rudder_ = 1500;
    int port_elevator_ = 1500;
    int stbd_elevator_ = 1500;

    // Timeout
    int arduino_timeout_ = 5;

    // LED
    bool led_switch_on = true;

    // Bot rolled over
    bool bot_rolled_over_{false};

    // Version Table
    std::map<uint32_t, std::set<std::string>> arduino_version_compatibility_table_;
    /**
     * TODO: make this var false
     * Then get the current version of the arduino driver
     * Check to see if the arduino code is compatible
     */
    bool is_driver_compatible_{true};
    bool is_settings_ack_{false};
    //This needs to be grabbed at runtime
    std::string app_version = "1.0.0~beta0+18+g2350a1a-0~ubuntu20.04.1";
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::ArduinoDriver>(
        goby::middleware::ProtobufConfigurator<config::ArduinoDriverConfig>(argc, argv));
}

// Main thread

jaiabot::apps::ArduinoDriver::ArduinoDriver()
    : zeromq::MultiThreadApplication<config::ArduinoDriverConfig>(10 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("command", goby::util::Colors::green);
    glog.add_group("arduino", goby::util::Colors::blue);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;
    launch_thread<SerialThread>(cfg().serial_arduino());

    // Creating Version Table
    for (auto row : cfg().arduino_version_table())
    {
        uint32_t arduino_version = row.arduino_version();
        for (auto app_versions : row.app_versions())
        { arduino_version_compatibility_table_[arduino_version].insert(app_versions); }
    }

    for (auto row : arduino_version_compatibility_table_)
    {
        glog.is_verbose() && glog << group("main") << "arduino_version: " << row.first << std::endl;

        for (auto app_version : row.second)
        {
            glog.is_verbose() && glog << group("main") << "\tapp_version: " << app_version
                                      << std::endl;
        }
    }

    std::string delimiter = "+";
    std::string version = app_version.substr(0, app_version.find(delimiter));

    glog.is_verbose() && glog << group("main") << "\tjaiabot-embedded version: " << version
                              << std::endl;

    // Setup our bounds configuration
    bounds_ = cfg().bounds();

    if (bounds_.motor().has_max_reverse())
    {
        max_reverse_ = bounds_.motor().max_reverse();
    }

    // Publish to meatadata group to record bounds file used
    interprocess().publish<groups::metadata>(bounds_);

    // Convert a ControlSurfaces command into an ArduinoCommand, and send to Arduino
    interprocess().subscribe<groups::low_control>(
        [this](const jaiabot::protobuf::LowControl& low_control) {
            if (low_control.has_control_surfaces())
            {
                glog.is_debug1() && glog << group("command")
                                         << "Received command: " << low_control.ShortDebugString()
                                         << std::endl;

                handle_control_surfaces(low_control.control_surfaces());
            }
        });
    // Get an ArduinoResponse
    interthread().subscribe<serial_in>([this](const goby::middleware::protobuf::IOData& io) {
        try
        {
            auto arduino_response = lora::parse<jaiabot::protobuf::ArduinoResponse>(io);
            if (arduino_response.status_code() > 1)
            {
                glog.is_warn() && glog << group("arduino")
                                       << "ArduinoResponse: " << arduino_response.ShortDebugString()
                                       << std::endl;

                // 9 is the settings status
                // TODO investigate enums with arduino protos
                // TODO remove this code block (Need version control working)
                if (arduino_response.status_code() == 9)
                {
                    is_settings_ack_ = true;
                }

                if (arduino_version_compatibility_table_.count(arduino_response.version()))
                {
                    if (arduino_version_compatibility_table_.at(arduino_response.version())
                            .count(app_version))
                    {
                        is_driver_compatible_ = true;

                        // 9 is the settings status
                        // TODO investigate enums with arduino protos
                        if (arduino_response.status_code() == 9)
                        {
                            is_settings_ack_ = true;
                        }
                    }
                }
            }

            glog.is_debug1() && glog << group("arduino") << "Received from Arduino: "
                                     << arduino_response.ShortDebugString() << std::endl;

            interprocess().publish<groups::arduino_to_pi>(arduino_response);
        }
        catch (const std::exception& e) //all exceptions thrown by the standard*  library
        {
            glog.is_warn() && glog << group("arduino")
                                   << "Arduino Response Parsing Failed: Exception Was Caught: "
                                   << e.what() << std::endl;
        }
        catch (...)
        {
            glog.is_warn() && glog << group("arduino")
                                   << "Arduino Response Parsing Failed: Exception Was Caught!"
                                   << std::endl;
        } // Catch all
    });

    interprocess().subscribe<groups::imu>([this](const jaiabot::protobuf::IMUData& imu_data) {
        if (imu_data.has_bot_rolled_over())
        {
            bot_rolled_over_ = imu_data.bot_rolled_over();
        }
    });
}

int jaiabot::apps::ArduinoDriver::surfaceValueToMicroseconds(int input, int lower, int center,
                                                             int upper)
{
    double microseconds = 0.0;

    if (bot_rolled_over_)
    {
        input = input * -1;
    }

    if (input > 0)
    {
        microseconds = center + (input / 100.0) * (upper - center);
    }
    else
    {
        microseconds = center + (input / 100.0) * (center - lower);
    }

    return microseconds;
}

void jaiabot::apps::ArduinoDriver::handle_control_surfaces(const ControlSurfaces& control_surfaces)
{
    if (control_surfaces.has_motor())
    {
        target_motor_ = 1500 + (control_surfaces.motor() / 100.0) * 400;

        // Do not go lower than max_reverse
        if (target_motor_ < max_reverse_)
        {
            target_motor_ = max_reverse_;
        }
    }

    if (control_surfaces.has_rudder())
    {
        rudder_ = surfaceValueToMicroseconds(control_surfaces.rudder(), bounds_.rudder().lower(),
                                             bounds_.rudder().center(), bounds_.rudder().upper());
    }

    if (control_surfaces.has_stbd_elevator())
    {
        stbd_elevator_ =
            surfaceValueToMicroseconds(control_surfaces.stbd_elevator(), bounds_.strb().lower(),
                                       bounds_.strb().center(), bounds_.strb().upper());
    }

    if (control_surfaces.has_port_elevator())
    {
        port_elevator_ =
            surfaceValueToMicroseconds(control_surfaces.port_elevator(), bounds_.port().lower(),
                                       bounds_.port().center(), bounds_.port().upper());
    }

    if (control_surfaces.has_timeout())
    {
        arduino_timeout_ = control_surfaces.timeout();
    }

    //pulls the data from on message to another
    if (control_surfaces.has_led_switch_on())
    {
        led_switch_on = control_surfaces.led_switch_on();
    }

    _time_last_command_received_ = now_microseconds();
}

void jaiabot::apps::ArduinoDriver::loop()
{
    jaiabot::protobuf::ArduinoCommand arduino_cmd;
    jaiabot::protobuf::ArduinoActuators arduino_actuators;
    jaiabot::protobuf::ArduinoSettings arduino_settings;

    if (!is_settings_ack_)
    {
        arduino_settings.set_forward_start(bounds_.motor().forwardstart());
        arduino_settings.set_reverse_start(bounds_.motor().reversestart());
        *arduino_cmd.mutable_settings() = arduino_settings;
    }
    else if (is_settings_ack_ && is_driver_compatible_)
    {
        arduino_actuators.set_timeout(arduino_timeout_);

        // If command is too old, then zero the Arduino
        if (_time_last_command_received_ != 0 &&
            now_microseconds() - _time_last_command_received_ > timeout_)
        {
            arduino_actuators.set_motor(1500);
            arduino_actuators.set_rudder(bounds_.rudder().center());
            arduino_actuators.set_stbd_elevator(bounds_.strb().center());
            arduino_actuators.set_port_elevator(bounds_.port().center());
            arduino_actuators.set_led_switch_on(false);

            *arduino_cmd.mutable_actuators() = arduino_actuators;

            // Publish interthread, so we can log it
            interprocess().publish<jaiabot::groups::arduino_from_pi>(arduino_cmd);

            // Send the command to the Arduino
            auto raw_output = lora::serialize(arduino_cmd);
            interthread().publish<serial_out>(raw_output);

            return;
        }
        // Don't use motor values of less power than the start bounds
        int corrected_motor;

        if (target_motor_ > 1500)
            corrected_motor = max(target_motor_, bounds_.motor().forwardstart());
        else if (target_motor_ == 1500)
            corrected_motor = target_motor_;
        else if (target_motor_ < 1500)
            corrected_motor = min(target_motor_, bounds_.motor().reversestart());

        arduino_actuators.set_motor(corrected_motor);
        arduino_actuators.set_rudder(rudder_);
        arduino_actuators.set_stbd_elevator(stbd_elevator_);
        arduino_actuators.set_port_elevator(port_elevator_);
        arduino_actuators.set_led_switch_on(led_switch_on);

        *arduino_cmd.mutable_actuators() = arduino_actuators;
    }

    glog.is_debug1() && glog << group("arduino")
                             << "Arduino Command: " << arduino_cmd.ShortDebugString() << std::endl;

    interprocess().publish<jaiabot::groups::arduino_from_pi>(arduino_cmd);

    // Send the command to the Arduino
    auto raw_output = lora::serialize(arduino_cmd);
    interthread().publish<serial_out>(raw_output);
}

void jaiabot::apps::ArduinoDriver::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    if (!is_driver_compatible_)
    {
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_error(protobuf::ERROR__VERSION__MISMATCH_ARDUINO);
        health.set_state(goby::middleware::protobuf::HEALTH__FAILED);
        glog.is_warn() &&
            glog << jaiabot::protobuf::Error_Name(protobuf::ERROR__VERSION__MISMATCH_ARDUINO)
                 << std::endl;
    }

    health.set_state(health_state);
}

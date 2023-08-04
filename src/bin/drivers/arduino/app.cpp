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
#include "jaiabot/version.h"

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
    void check_last_report(goby::middleware::protobuf::ThreadHealth& health,
                           goby::middleware::protobuf::HealthState& health_state);
    void handle_control_surfaces(const ControlSurfaces& control_surfaces);
    int surfaceValueToMicroseconds(int input, int lower, int center, int upper);

    int64_t lastAckTime;

    uint64_t _time_last_command_received = 0;
    const uint64_t timeout = 5e6;

    jaiabot::protobuf::Bounds bounds;

    // Motor
    int target_motor = 1500;
    int max_reverse = 1320;

    // Control surfaces
    int rudder = 1500;
    int port_elevator = 1500;
    int stbd_elevator = 1500;

    // Timeout
    int arduino_timeout = 5;

    // LED
    bool led_switch_on = true;

    // Bot rolled over
    bool bot_rolled_over_{false};

    // Version Table
    std::map<uint32_t, std::set<std::string>> arduino_version_compatibility_table_;
    std::map<uint32_t, std::set<std::string>> arduino_version_incompatibility_table_;
    bool is_driver_compatible_{false};
    bool is_settings_ack_{false};
    std::string app_version_{VERSION_STRING};
    std::string delimiter_{"+"};
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

    // Creating Compatible Version Table
    for (auto row : cfg().arduino_version_table())
    {
        uint32_t arduino_version = row.arduino_version();
        for (auto app_versions_compatible : row.app_versions_compatible())
        { arduino_version_compatibility_table_[arduino_version].insert(app_versions_compatible); }
    }

    for (auto row : arduino_version_compatibility_table_)
    {
        glog.is_verbose() && glog << group("main") << "arduino_version: " << row.first << std::endl;

        for (auto app_versions_compatible : row.second)
        {
            glog.is_verbose() && glog << group("main")
                                      << "\tapp_version compatible: " << app_versions_compatible
                                      << std::endl;
        }
    }

    // Creating Incompatible Version Table
    for (auto row : cfg().arduino_version_table())
    {
        uint32_t arduino_version = row.arduino_version();
        for (auto app_versions_incompatible : row.app_versions_incompatible())
        {
            arduino_version_incompatibility_table_[arduino_version].insert(
                app_versions_incompatible);
        }
    }

    for (auto row : arduino_version_incompatibility_table_)
    {
        glog.is_verbose() && glog << group("main") << "arduino_version: " << row.first << std::endl;

        for (auto app_versions_incompatible : row.second)
        {
            glog.is_verbose() && glog << group("main")
                                      << "\tapp_version incompatible: " << app_versions_incompatible
                                      << std::endl;
        }
    }

    // Let's just get the major, minor, and patch number without git hash
    app_version_ = app_version_.substr(0, app_version_.find(delimiter_));

    glog.is_verbose() && glog << group("main") << "\tarduino driver version: " << app_version_
                              << std::endl;

    // Setup our bounds configuration
    bounds = cfg().bounds();

    if (bounds.motor().has_max_reverse())
    {
        max_reverse = bounds.motor().max_reverse();
    }

    // Publish to meatadata group to record bounds file used
    interprocess().publish<groups::metadata>(bounds);

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
            if (arduino_response.status_code() != protobuf::ArduinoStatusCode::STARTUP)
            {
                glog.is_warn() && glog << group("arduino")
                                       << "ArduinoResponse: " << arduino_response.ShortDebugString()
                                       << std::endl;

                if (arduino_version_compatibility_table_.count(arduino_response.version()))
                {
                    if (arduino_version_compatibility_table_.at(arduino_response.version())
                            .count(app_version_))
                    {
                        glog.is_verbose() && glog << group("main")
                                                  << "Arduino Driver is compatible: " << std::endl;
                        is_driver_compatible_ = true;

                        if (arduino_response.status_code() == protobuf::ArduinoStatusCode::SETTINGS)
                        {
                            glog.is_verbose() &&
                                glog << group("main")
                                     << "Settings were Ack by arduino: " << std::endl;
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
        target_motor = 1500 + (control_surfaces.motor() / 100.0) * 400;

        // Do not go lower than max_reverse
        if (target_motor < max_reverse)
        {
            target_motor = max_reverse;
        }
    }

    if (control_surfaces.has_rudder())
    {
        rudder = surfaceValueToMicroseconds(control_surfaces.rudder(), bounds.rudder().lower(),
                                            bounds.rudder().center(), bounds.rudder().upper());
    }

    if (control_surfaces.has_stbd_elevator())
    {
        stbd_elevator =
            surfaceValueToMicroseconds(control_surfaces.stbd_elevator(), bounds.strb().lower(),
                                       bounds.strb().center(), bounds.strb().upper());
    }

    if (control_surfaces.has_port_elevator())
    {
        port_elevator =
            surfaceValueToMicroseconds(control_surfaces.port_elevator(), bounds.port().lower(),
                                       bounds.port().center(), bounds.port().upper());
    }

    if (control_surfaces.has_timeout())
    {
        arduino_timeout = control_surfaces.timeout();
    }

    //pulls the data from on message to another
    if (control_surfaces.has_led_switch_on())
    {
        led_switch_on = control_surfaces.led_switch_on();
    }

    _time_last_command_received = now_microseconds();
}

void jaiabot::apps::ArduinoDriver::loop()
{
    jaiabot::protobuf::ArduinoCommand arduino_cmd;
    jaiabot::protobuf::ArduinoActuators arduino_actuators;
    jaiabot::protobuf::ArduinoSettings arduino_settings;

    if (!is_settings_ack_)
    {
        arduino_settings.set_forward_start(bounds.motor().forwardstart());
        arduino_settings.set_reverse_start(bounds.motor().reversestart());
        *arduino_cmd.mutable_settings() = arduino_settings;
    }
    else if (is_settings_ack_ && is_driver_compatible_)
    {
        arduino_actuators.set_timeout(arduino_timeout);

        // If command is too old, then zero the Arduino
        if (_time_last_command_received != 0 &&
            now_microseconds() - _time_last_command_received > timeout)
        {
            arduino_actuators.set_motor(1500);
            arduino_actuators.set_rudder(bounds.rudder().center());
            arduino_actuators.set_stbd_elevator(bounds.strb().center());
            arduino_actuators.set_port_elevator(bounds.port().center());
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

        if (target_motor > 1500)
            corrected_motor = max(target_motor, bounds.motor().forwardstart());
        else if (target_motor == 1500)
            corrected_motor = target_motor;
        else if (target_motor < 1500)
            corrected_motor = min(target_motor, bounds.motor().reversestart());

        arduino_actuators.set_motor(corrected_motor);
        arduino_actuators.set_rudder(rudder);
        arduino_actuators.set_stbd_elevator(stbd_elevator);
        arduino_actuators.set_port_elevator(port_elevator);
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
        check_last_report(health, health_state);
    }

    health.set_state(health_state);
}

void jaiabot::apps::ArduinoDriver::check_last_report(
    goby::middleware::protobuf::ThreadHealth& health,
    goby::middleware::protobuf::HealthState& health_state)
{
    health_state = goby::middleware::protobuf::HEALTH__FAILED;
    health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
        ->add_error(protobuf::ERROR__VERSION__MISMATCH_ARDUINO);
}

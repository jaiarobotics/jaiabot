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
class ControlSurfacesDriver : public zeromq::MultiThreadApplication<config::ControlSurfacesDriver>
{
  public:
    ControlSurfacesDriver();

  private:
    void loop() override;
    void handle_control_surfaces(const ControlSurfaces& control_surfaces);

    int64_t lastAckTime;

    uint64_t _time_last_command_received = 0;
    const uint64_t timeout = 5e6;

    jaiabot::protobuf::Bounds bounds;

    // Motor
    int current_motor = 1500;
    int target_motor = 1500;
    const int motor_max_step = 25;

    // Control surfaces
    int rudder = 1500;
    int port_elevator = 1500;
    int stbd_elevator = 1500;

    // timeout
    int arduino_timeout = 5;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::ControlSurfacesDriver>(
        goby::middleware::ProtobufConfigurator<config::ControlSurfacesDriver>(argc, argv));
}

// Main thread

jaiabot::apps::ControlSurfacesDriver::ControlSurfacesDriver()
    : zeromq::MultiThreadApplication<config::ControlSurfacesDriver>(4 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("command", goby::util::Colors::green);
    glog.add_group("arduino", goby::util::Colors::blue);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;
    launch_thread<SerialThread>(cfg().serial_arduino());

    // Setup our bounds configuration
    bounds = cfg().bounds();

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
    interthread().subscribe<serial_in>(
        [this](const goby::middleware::protobuf::IOData& io)
        {
            auto arduino_response = lora::parse<jaiabot::protobuf::ArduinoResponse>(io);

            glog.is_debug1() && glog << group("arduino") << "Received from Arduino: "
                                     << arduino_response.ShortDebugString() << std::endl;

            if (arduino_response.has_message() && arduino_response.message().length() > 0)
            {
                glog.is_warn() && glog << group("arduino") << arduino_response.message()
                                       << std::endl;
            }

            interprocess().publish<groups::arduino>(arduino_response);
        });
}

int surfaceValueToMicroseconds(int input, int lower, int center, int upper)
{
    if (input > 0)
    {
        return center + (input / 100.0) * (upper - center);
    }
    else
    {
        return center + (input / 100.0) * (center - lower);
    }
}

void jaiabot::apps::ControlSurfacesDriver::handle_control_surfaces(
    const ControlSurfaces& control_surfaces)
{
    if (control_surfaces.has_motor())
    {
        target_motor = 1500 + (control_surfaces.motor() / 100.0) * 400;
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

    _time_last_command_received = now_microseconds();
}

void jaiabot::apps::ControlSurfacesDriver::loop() {
    jaiabot::protobuf::ArduinoCommand arduino_cmd;
    arduino_cmd.set_timeout(arduino_timeout);

    // If command is too old, then zero the Arduino
    if (_time_last_command_received != 0 &&
        now_microseconds() - _time_last_command_received > timeout)
    {
        arduino_cmd.set_motor(1500);
        arduino_cmd.set_rudder(bounds.rudder().center());
        arduino_cmd.set_stbd_elevator(bounds.strb().center());
        arduino_cmd.set_port_elevator(bounds.port().center());

        // Publish interthread, so we can log it
        interprocess().publish<jaiabot::groups::arduino>(arduino_cmd);

        // Send the command to the Arduino
        auto raw_output = lora::serialize(arduino_cmd);
        interthread().publish<serial_out>(raw_output);

        return;
    }

    // Motor
    // Move toward target_motor
    if (target_motor > current_motor)
    {
        current_motor += min(target_motor - current_motor, motor_max_step);
    }
    else
    {
        current_motor -= min(current_motor - target_motor, motor_max_step);
    }

    // Don't use motor values of less power than the start bounds
    int corrected_motor;

    if (current_motor > 1500)
        corrected_motor = max(current_motor, bounds.motor().forwardstart());
    if (current_motor == 1500)
        corrected_motor = current_motor;
    if (current_motor < 1500)
        corrected_motor = min(current_motor, bounds.motor().reversestart());

    arduino_cmd.set_motor(corrected_motor);

    arduino_cmd.set_rudder(rudder);
    arduino_cmd.set_stbd_elevator(stbd_elevator);
    arduino_cmd.set_port_elevator(port_elevator);

    glog.is_debug1() && glog << group("arduino")
                             << "Arduino Command: " << arduino_cmd.ShortDebugString() << std::endl;

    interprocess().publish<jaiabot::groups::arduino>(arduino_cmd);

    // Send the command to the Arduino
    auto raw_output = lora::serialize(arduino_cmd);
    interthread().publish<serial_out>(raw_output);
}

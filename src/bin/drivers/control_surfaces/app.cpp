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
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/lora/serial.h"
#include "jaiabot/messages/arduino.pb.h"
#include "jaiabot/messages/low_control.pb.h"

#define now_microseconds() (goby::time::SystemClock::now<goby::time::MicroTime>().value())

using goby::glog;
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

    int64_t lastAckTime;
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
    : zeromq::MultiThreadApplication<config::ControlSurfacesDriver>(10 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;
    launch_thread<SerialThread>(cfg().serial_arduino());

    // Convert a ControlSurfaces command into an ArduinoCommand, and send to Arduino
    interprocess().subscribe<groups::low_control>(
        [this](const jaiabot::protobuf::LowControl& low_control) {
            if (low_control.has_control_surfaces())
            {
                glog.is_verbose() && glog << group("main")
                                          << "Received command: " << low_control.ShortDebugString()
                                          << std::endl;

                auto control_surfaces = low_control.control_surfaces();

                jaiabot::protobuf::ArduinoCommand arduino_cmd;
                arduino_cmd.set_motor(1500);
                arduino_cmd.set_rudder(1500);
                arduino_cmd.set_stbd_elevator(1500);
                arduino_cmd.set_port_elevator(1500);
                arduino_cmd.set_timeout(control_surfaces.timeout());

                auto raw_output = lora::serialize(arduino_cmd);
                interthread().publish<serial_out>(raw_output);
            }
        });

    // Get an ArduinoResponse
    interthread().subscribe<serial_in>(
        [this](const goby::middleware::protobuf::IOData& io)
        {
            auto arduino_response = lora::parse<jaiabot::protobuf::ArduinoResponse>(io);

            glog.is_debug1() && glog << group("main") << "Received from Arduino: "
                                     << arduino_response.ShortDebugString() << std::endl;

            if (arduino_response.has_message())
            {
                glog.is_warn() && glog << group("main") << arduino_response.message() << std::endl;
            }

            interprocess().publish<groups::arduino_response>(arduino_response);
        });
}

void jaiabot::apps::ControlSurfacesDriver::loop() {
}

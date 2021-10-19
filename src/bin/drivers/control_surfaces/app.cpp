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
#include "jaiabot/messages/control_command.pb.h"

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
    : zeromq::MultiThreadApplication<config::ControlSurfacesDriver>(0 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;
    launch_thread<SerialThread>(cfg().serial_arduino());

    interprocess().subscribe<groups::control_command>(
        [this](const jaiabot::protobuf::ControlCommand& control_command) {

        if (control_command.has_low_level_control()) {
            glog.is_verbose() && glog << group("main")
                                        << "Sending: " << control_command.ShortDebugString()
                                        << std::endl;

            auto raw_output = lora::serialize(control_command.low_level_control());
            interthread().publish<serial_out>(raw_output);
        }
    });

    interthread().subscribe<serial_in>([this](
                                            const goby::middleware::protobuf::IOData& io) {

        auto control_ack = lora::parse<jaiabot::protobuf::LowLevelAck>(io);

        glog.is_verbose() && glog << group("main")
                                    << control_ack.ShortDebugString() << std::endl;

    });

}

void jaiabot::apps::ControlSurfacesDriver::loop() {}

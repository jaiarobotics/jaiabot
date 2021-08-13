// Copyright 2021:
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

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/lora/serial.h"
#include "jaiabot/messages/low_control.pb.h"

using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;

constexpr goby::middleware::Group serial_in{"test::xbee::serial_in"};
constexpr goby::middleware::Group serial_out{"test::xbee::serial_out"};

namespace jaiabot
{
namespace apps
{
class ControlSurfacesTest : public zeromq::MultiThreadApplication<config::ControlSurfacesTest>
{
  public:
    ControlSurfacesTest();

  private:
    void loop() override;
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::ControlSurfacesTest>(
        goby::middleware::ProtobufConfigurator<config::ControlSurfacesTest>(argc, argv));
}

// Main thread

jaiabot::apps::ControlSurfacesTest::ControlSurfacesTest()
    : zeromq::MultiThreadApplication<config::ControlSurfacesTest>(10 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using SerialThread = jaiabot::lora::SerialThreadLoRaFeather<serial_in, serial_out>;
    launch_thread<SerialThread>(cfg().serial());

    switch (cfg().mode())
    {
        case config::ControlSurfacesTest::BOX:
            // command from Liaison -> XBee
            interprocess().subscribe<groups::control_command>(
                [this](const jaiabot::protobuf::ControlCommand& pb_msg) {
                    glog.is_verbose() && glog << group("main")
                                              << "Sending: " << pb_msg.ShortDebugString()
                                              << std::endl;
                    auto io = lora::serialize(pb_msg);
                    interthread().publish<serial_out>(io);
                });

            // ack from Xbee -> Liaison
            interthread().subscribe<serial_in>([this](
                                                   const goby::middleware::protobuf::IOData& io) {
                auto pb_msg = lora::parse<jaiabot::protobuf::ControlAck>(io);
                glog.is_verbose() && glog << group("main")
                                          << "Received: " << pb_msg.ShortDebugString() << std::endl;

                interprocess().publish<groups::control_ack>(pb_msg);
            });

            break;
        case config::ControlSurfacesTest::BOT:
            // command from Xbee -> jaiabot_lora_test
            interthread().subscribe<serial_in>([this](
                                                   const goby::middleware::protobuf::IOData& io) {
                auto pb_msg = lora::parse<jaiabot::protobuf::ControlCommand>(io);
                glog.is_verbose() && glog << group("main")
                                          << "Received: " << pb_msg.ShortDebugString() << std::endl;

                interprocess().publish<groups::control_command>(pb_msg);

                protobuf::ControlAck ack;
                ack.set_id(pb_msg.id());
                ack.set_vehicle(pb_msg.vehicle());
                ack.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
                ack.set_command_time(pb_msg.time());

                glog.is_verbose() && glog << group("main") << "Sending: " << ack.ShortDebugString()
                                          << std::endl;
                auto io_ack = lora::serialize(ack);
                interthread().publish<serial_out>(io_ack);
            });
            break;
    }
}

void jaiabot::apps::ControlSurfacesTest::loop() {}

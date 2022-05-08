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
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/portal.pb.h"
#include "jaiabot/messages/salinity.pb.h"

#include <vector>

#define NOW (goby::time::SystemClock::now<goby::time::MicroTime>())
using namespace std;
using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;
using UDPEndPoint = goby::middleware::protobuf::UDPEndPoint;

namespace jaiabot
{
namespace apps
{

constexpr goby::middleware::Group web_portal_udp_in{"web_portal_udp_in"};
constexpr goby::middleware::Group web_portal_udp_out{"web_portal_udp_out"};

class WebPortal : public zeromq::MultiThreadApplication<config::WebPortal>
{
  public:
    WebPortal();

  private:
    UDPEndPoint dest;

    jaiabot::protobuf::BotStatus hub_status;

    void loop() override;

    void process_client_message(jaiabot::protobuf::ClientToPortalMessage& msg);
    void send_message_to_client(const jaiabot::protobuf::PortalToClientMessage& message);
};

} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::WebPortal>(
        goby::middleware::ProtobufConfigurator<config::WebPortal>(argc, argv));
}

// Main thread

jaiabot::apps::WebPortal::WebPortal()
    : zeromq::MultiThreadApplication<config::WebPortal>(0.5 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using UDPThread = goby::middleware::io::UDPOneToManyThread<web_portal_udp_in, web_portal_udp_out>;
    launch_thread<UDPThread>(cfg().udp_config());

    glog.is_debug1() && glog << group("main") << "Web Portal Started" << endl;
    glog.is_debug1() && glog << group("main") << "Config:" << cfg().ShortDebugString() << endl;

    ///////////// INPUT from Client
    interthread().subscribe<web_portal_udp_in>([this](const goby::middleware::protobuf::IOData& io_data) {
        glog.is_debug2() && glog << group("main") << "Data: " << io_data.ShortDebugString() << endl;

        auto command = jaiabot::protobuf::ClientToPortalMessage();
        if (command.ParseFromString(io_data.data())) {
            process_client_message(command);

            dest.set_addr(io_data.udp_src().addr());
            dest.set_port(io_data.udp_src().port());
        }
        else {
            glog.is_warn() && glog << group("main") << "Could not parse incoming message from client: " << io_data.ShortDebugString() << endl;
        }
    });

    dest.set_addr("");
    dest.set_port(0);

    // Subscribe to bot statuses coming in over intervehicle
    interprocess().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>([this](const jaiabot::protobuf::BotStatus& dccl_nav) {
        glog.is_debug2() && glog << group("main")
                                 << "Received DCCL nav: " << dccl_nav.ShortDebugString() << endl;

        auto message = jaiabot::protobuf::PortalToClientMessage();
        message.set_allocated_bot_status(new jaiabot::protobuf::BotStatus(dccl_nav));

        send_message_to_client(message);
    });

    // Subscribe to hub GPS updates
    hub_status.set_bot_id(255);

    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            glog.is_debug2() && glog << "Received TimePositionVelocity update: "
                                     << tpv.ShortDebugString() << endl;

            if (tpv.has_location())
            {
                // Send "bot" status of bot_id == 255 for the hub
                hub_status.mutable_location()->set_lat(tpv.location().lat());
                hub_status.mutable_location()->set_lon(tpv.location().lon());
                hub_status.mutable_speed()->set_over_ground(tpv.speed());
            }
        });


    // Subscribe to engineering status messages
    interprocess().subscribe<jaiabot::groups::engineering_status>([this](const jaiabot::protobuf::EngineeringStatus& engineering_status) {
        glog.is_debug1() && glog << "Sending engineering_status to client: " << engineering_status.ShortDebugString() << endl;

        auto message = jaiabot::protobuf::PortalToClientMessage();
        message.set_allocated_engineering_status(new jaiabot::protobuf::EngineeringStatus(engineering_status));

        send_message_to_client(message);
    });
}

void jaiabot::apps::WebPortal::process_client_message(jaiabot::protobuf::ClientToPortalMessage& msg)
{
    glog.is_debug1() && glog << group("main") << "Received message from client: " << msg.ShortDebugString() << endl;

    if (msg.has_engineering_command()) {
        auto engineering_command = msg.engineering_command();
        auto t = NOW;
        engineering_command.set_time_with_units(t);

        glog.is_debug2() && glog << group("main") << "Sending engineering_command: " << engineering_command.ShortDebugString() << endl;
        intervehicle().publish<jaiabot::groups::engineering_command>(engineering_command);
    }

    if (msg.has_command()) {
        using jaiabot::protobuf::Command;
        auto command = msg.command();

        glog.is_debug2() && glog << group("main")
                                 << "Sending command: " << command.ShortDebugString() << endl;

        goby::middleware::Publisher<Command> command_publisher(
            {}, [](Command& cmd, const goby::middleware::Group& group)
            { cmd.set_bot_id(group.numeric()); });

        intervehicle().publish_dynamic(
            command, goby::middleware::DynamicGroup(jaiabot::groups::hub_command, command.bot_id()),
            command_publisher);
    }
}

void jaiabot::apps::WebPortal::loop()
{
    // Send hub status
    hub_status.set_time_with_units(NOW);

    auto message = jaiabot::protobuf::PortalToClientMessage();
    message.set_allocated_bot_status(new jaiabot::protobuf::BotStatus(hub_status));

    send_message_to_client(message);
}

void jaiabot::apps::WebPortal::send_message_to_client(const jaiabot::protobuf::PortalToClientMessage& message) {
    if (dest.addr() == "") {
        return;
    }

    glog.is_debug1() && glog << group("main") << "Sending message to client: " << message.ShortDebugString() << endl;

    auto io_data = make_shared<goby::middleware::protobuf::IOData>();
    io_data->mutable_udp_dest()->set_addr(dest.addr());
    io_data->mutable_udp_dest()->set_port(dest.port());

    // Serialize for the UDP packet
    string data;
    message.SerializeToString(&data);
    io_data->set_data(data);

    // Send it
    interthread().publish<web_portal_udp_out>(io_data);

    glog.is_debug2() && glog << group("main") << "Sent: " << io_data->ShortDebugString() << endl;
}

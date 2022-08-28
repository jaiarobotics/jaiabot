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
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/io/udp_point_to_point.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/zeromq/application/multi_thread.h>

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

// We need to define a comparison operator, so we can build a set of UDPEndPoint
namespace goby
{
namespace middleware
{
namespace protobuf
{
bool operator==(const goby::middleware::protobuf::UDPEndPoint a,
                const goby::middleware::protobuf::UDPEndPoint b)
{
    return a.addr() == b.addr() && a.port() == b.port();
}
} // namespace protobuf
} // namespace middleware
} // namespace goby

// Define a hash for unordered_map
class UDPEndPointHash
{
  public:
    size_t operator()(const UDPEndPoint& p) const
    {
        string key = p.addr() + to_string(p.port());
        return hash<string>()(key);
    }
};

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
    unordered_set<goby::middleware::protobuf::UDPEndPoint, UDPEndPointHash> client_endpoints;

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

    using UDPThread =
        goby::middleware::io::UDPOneToManyThread<web_portal_udp_in, web_portal_udp_out>;
    launch_thread<UDPThread>(cfg().udp_config());

    glog.is_debug1() && glog << group("main") << "Web Portal Started" << endl;
    glog.is_debug1() && glog << group("main") << "Config:" << cfg().ShortDebugString() << endl;

    ///////////// INPUT from Client
    interthread().subscribe<web_portal_udp_in>(
        [this](const goby::middleware::protobuf::IOData& io_data) {
            glog.is_debug2() && glog << group("main") << "Data: " << io_data.ShortDebugString()
                                     << endl;

            jaiabot::protobuf::ClientToPortalMessage command;
            if (command.ParseFromString(io_data.data()))
            {
                process_client_message(command);
                client_endpoints.insert(io_data.udp_src());
            }
            else
            {
                glog.is_warn() && glog << group("main")
                                       << "Could not parse incoming message from client: "
                                       << io_data.ShortDebugString() << endl;
            }
        });

    // Subscribe to bot statuses coming in over intervehicle
    interprocess().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
        [this](const jaiabot::protobuf::BotStatus& dccl_nav) {
            glog.is_debug2() && glog << group("main")
                                     << "Received DCCL nav: " << dccl_nav.ShortDebugString()
                                     << endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_bot_status() = dccl_nav;

            send_message_to_client(message);
        });

    // Subscribe to hub statuses from hub manager
    interprocess().subscribe<jaiabot::groups::hub_status>(
        [this](const jaiabot::protobuf::HubStatus& hub_status) {
            glog.is_debug2() && glog << group("main")
                                     << "Received Hub status: " << hub_status.ShortDebugString()
                                     << endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_hub_status() = hub_status;
            send_message_to_client(message);
        });

    // Subscribe to engineering status messages
    interprocess().subscribe<jaiabot::groups::engineering_status>(
        [this](const jaiabot::protobuf::Engineering& engineering_status) {
            glog.is_debug1() && glog << "Sending engineering_status to client: "
                                     << engineering_status.ShortDebugString() << endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_engineering_status() = engineering_status;

            send_message_to_client(message);
        });

    // Subscribe to DivePackets
    interprocess().subscribe<jaiabot::groups::dive_packet>(
        [this](const jaiabot::protobuf::DivePacket& dive_packet) {
            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_dive_packet() = dive_packet;

            send_message_to_client(message);
        });
}

void jaiabot::apps::WebPortal::process_client_message(jaiabot::protobuf::ClientToPortalMessage& msg)
{
    glog.is_verbose() && glog << group("main")
                              << "Received message from client: " << msg.ShortDebugString() << endl;

    if (msg.has_engineering_command())
    {
        auto engineering_command = msg.engineering_command();

        glog.is_debug2() && glog << group("main") << "Sending engineering_command: "
                                 << engineering_command.ShortDebugString() << endl;

        goby::middleware::Publisher<jaiabot::protobuf::Engineering> command_publisher(
            {}, [](jaiabot::protobuf::Engineering& cmd, const goby::middleware::Group& group) {
                cmd.set_bot_id(group.numeric());
            });

        intervehicle().publish_dynamic(
            engineering_command,
            goby::middleware::DynamicGroup(jaiabot::groups::engineering_command,
                                           engineering_command.bot_id()),
            command_publisher);
    }

    if (msg.has_command())
    {
        using jaiabot::protobuf::Command;
        auto command = msg.command();

        glog.is_debug2() && glog << group("main")
                                 << "Sending command: " << command.ShortDebugString() << endl;

        goby::middleware::Publisher<Command> command_publisher(
            {}, [](Command& cmd, const goby::middleware::Group& group) {
                cmd.set_bot_id(group.numeric());
            });

        intervehicle().publish_dynamic(
            command, goby::middleware::DynamicGroup(jaiabot::groups::hub_command, command.bot_id()),
            command_publisher);
    }
}

void jaiabot::apps::WebPortal::loop() {}

void jaiabot::apps::WebPortal::send_message_to_client(
    const jaiabot::protobuf::PortalToClientMessage& message)
{
    for (auto dest : client_endpoints)
    {
        glog.is_debug2() && glog << group("main")
                                 << "Sending message to client: " << message.ShortDebugString()
                                 << endl;

        auto io_data = make_shared<goby::middleware::protobuf::IOData>();
        io_data->mutable_udp_dest()->set_addr(dest.addr());
        io_data->mutable_udp_dest()->set_port(dest.port());

        // Serialize for the UDP packet
        string data;
        message.SerializeToString(&data);
        io_data->set_data(data);

        // Send it
        interthread().publish<web_portal_udp_out>(io_data);

        glog.is_debug2() && glog << group("main") << "Sent: " << io_data->ShortDebugString()
                                 << endl;
    }
}

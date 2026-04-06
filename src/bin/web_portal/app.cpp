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
#include "jaiabot/intervehicle.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/portal.pb.h"

#include <vector>

#define NOW (goby::time::SystemClock::now<goby::time::MicroTime>())
using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;
using UDPEndPoint = goby::middleware::protobuf::UDPEndPoint;

typedef int BotId;

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
        std::string key = p.addr() + std::to_string(p.port());
        return std::hash<std::string>()(key);
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
    std::unordered_set<goby::middleware::protobuf::UDPEndPoint, UDPEndPointHash> client_endpoints;

    std::map<BotId, jaiabot::protobuf::MissionPlan> active_mission_plans;

    void loop() override;

    void process_client_message(jaiabot::protobuf::ClientToPortalMessage& msg);
    void handle_command(const jaiabot::protobuf::Command& command);
    void handle_command_for_hub(const jaiabot::protobuf::CommandForHub& command_for_hub);

    void send_message_to_client(const jaiabot::protobuf::PortalToClientMessage& message);

    jaiabot::protobuf::DeviceMetadata device_metadata_;
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
    : zeromq::MultiThreadApplication<config::WebPortal>(0.1 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);
    glog.add_group("bot_status", goby::util::Colors::green);
    glog.add_group("eng", goby::util::Colors::blue);
    glog.add_group("hub_status", goby::util::Colors::lt_blue);
    glog.add_group("task_packet", goby::util::Colors::magenta);
    glog.add_group("metadata", goby::util::Colors::lt_magenta);
    glog.add_group("contact", goby::util::Colors::cyan);
    glog.add_group("cmd_result", goby::util::Colors::white);
    glog.add_group("command", goby::util::Colors::lt_white);

    using UDPThread =
        goby::middleware::io::UDPOneToManyThread<web_portal_udp_in, web_portal_udp_out>;
    launch_thread<UDPThread>(cfg().udp_config());

    glog.is_debug1() && glog << group("main") << "Web Portal Started" << std::endl;
    glog.is_debug1() && glog << group("main") << "Config:" << cfg().ShortDebugString() << std::endl;

    ///////////// INPUT from Client
    interthread().subscribe<web_portal_udp_in>(
        [this](const goby::middleware::protobuf::IOData& io_data)
        {
            glog.is_debug2() && glog << group("main") << "Data: " << io_data.ShortDebugString()
                                     << std::endl;

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
                                       << io_data.ShortDebugString() << std::endl;
            }
        });

    // Subscribe to bot statuses coming in over intervehicle
    interprocess().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
        [this](const jaiabot::protobuf::BotStatus& bot_status)
        {
            glog.is_debug2() && glog << group("bot_status")
                                     << "Received BotStatus: " << bot_status.ShortDebugString()
                                     << std::endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_bot_status() = bot_status;

            // If this bot has an active mission, let's attach that too
            if (active_mission_plans.count(bot_status.bot_id()) > 0)
            {
                *message.mutable_active_mission_plan() = active_mission_plans[bot_status.bot_id()];
            }

            send_message_to_client(message);
        });

    // Subscribe to hub statuses from hub manager
    interprocess().subscribe<jaiabot::groups::hub_status>(
        [this](const jaiabot::protobuf::HubStatus& hub_status)
        {
            glog.is_debug2() && glog << group("hub_status")
                                     << "Received Hub status: " << hub_status.ShortDebugString()
                                     << std::endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_hub_status() = hub_status;
            send_message_to_client(message);
        });

    // Subscribe to engineering status messages
    interprocess().subscribe<jaiabot::groups::engineering_status>(
        [this](const jaiabot::protobuf::Engineering& engineering_status)
        {
            glog.is_debug1() && glog << group("eng") << "Sending engineering_status to client: "
                                     << engineering_status.ShortDebugString() << std::endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_engineering_status() = engineering_status;
            send_message_to_client(message);
        });

    // Subscribe to TaskPackets
    interprocess().subscribe<jaiabot::groups::task_packet>(
        [this](const jaiabot::protobuf::TaskPacket& task_packet)
        {
            glog.is_debug1() && glog << group("task_packet") << "Sending task_packet to client: "
                                     << task_packet.ShortDebugString() << std::endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_task_packet() = task_packet;
            send_message_to_client(message);
        });

    // Subscribe to MetaData
    interprocess().subscribe<jaiabot::groups::metadata>(
        [this](const jaiabot::protobuf::DeviceMetadata& metadata)
        {
            glog.is_debug1() && glog << group("metadata") << "Sending task_packet to client: "
                                     << metadata.ShortDebugString() << std::endl;

            jaiabot::protobuf::PortalToClientMessage message;
            device_metadata_ = metadata;
        });

    // Subscribe to ContactUpdate
    interprocess().subscribe<jaiabot::groups::contact_update>(
        [this](const jaiabot::protobuf::ContactUpdate contact_update)
        {
            glog.is_debug1() && glog << group("contact") << "Sending contact_update to client: "
                                     << contact_update.ShortDebugString() << std::endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_contact_update() = contact_update;
            send_message_to_client(message);
        });

    // comms result from hub_manager
    interprocess().subscribe<jaiabot::groups::hub_command_result>(
        [this](const jaiabot::protobuf::CommandCommsResult& cmd_result)
        {
            glog.is_debug1() && glog << group("cmd_result") << "Sending command result to client: "
                                     << cmd_result.ShortDebugString() << std::endl;

            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_command_comms_result() = cmd_result;
            send_message_to_client(message);
        });

    // Subscribe to Hub2HubData from other hubs (re-published on interprocess by hub_manager)
    interprocess().subscribe<jaiabot::groups::remote_hub_command>(
        [this](const jaiabot::protobuf::Command& remote_command)
        {
            glog.is_debug2() && glog << group("command") << "Received Command from remote hub "
                                     << remote_command.from_hub_id() << ": "
                                     << remote_command.ShortDebugString() << std::endl;

            // Notify JCC clients of the remote command
            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_remote_command() = remote_command;
            send_message_to_client(message);
        });
}

void jaiabot::apps::WebPortal::process_client_message(jaiabot::protobuf::ClientToPortalMessage& msg)
{
    glog.is_verbose() && glog << group("main")
                              << "Received message from client: " << msg.ShortDebugString()
                              << std::endl;

    // Republish the message on interprocess, to get it into the logs
    interprocess().publish<jaiabot::groups::web_portal>(msg);

    if (msg.has_engineering_command())
    {
        auto engineering_command = msg.engineering_command();

        glog.is_debug2() && glog << group("eng") << "Sending engineering_command: "
                                 << msg.engineering_command().ShortDebugString() << std::endl;

        intervehicle().publish_dynamic(
            engineering_command,
            intervehicle::engineering_command_group(engineering_command.bot_id()),
            intervehicle::default_publisher<jaiabot::protobuf::Engineering>);
    }

    if (msg.has_command())
    {
        glog.is_debug1() && glog << group("command")
                                 << "Sending command for bot: " << msg.command().ShortDebugString()
                                 << std::endl;

        handle_command(msg.command());
    }

    if (msg.has_command_for_hub())
    {
        glog.is_debug1() && glog << group("command") << "Sending command for hub: "
                                 << msg.command_for_hub().ShortDebugString() << std::endl;

        handle_command_for_hub(msg.command_for_hub());
    }
}

void jaiabot::apps::WebPortal::loop()
{
    if (device_metadata_.has_jaiabot_version() && device_metadata_.has_is_simulation())
    {
        jaiabot::protobuf::PortalToClientMessage message;
        *message.mutable_device_metadata() = device_metadata_;
        glog.is_debug2() && glog << group("main") << "Sending metadata to client: "
                                 << device_metadata_.ShortDebugString() << std::endl;
        send_message_to_client(message);
    }
    else
    {
        glog.is_debug2() && glog << group("main")
                                 << "Query for metadata: " << device_metadata_.ShortDebugString()
                                 << std::endl;
        jaiabot::protobuf::QueryDeviceMetaData query_device_metadata;
        interprocess().publish<groups::metadata>(query_device_metadata);
    }
}

void jaiabot::apps::WebPortal::send_message_to_client(
    const jaiabot::protobuf::PortalToClientMessage& message)
{
    for (auto dest : client_endpoints)
    {
        glog.is_debug2() && glog << group("main")
                                 << "Sending message to client: " << message.ShortDebugString()
                                 << std::endl;

        auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
        io_data->mutable_udp_dest()->set_addr(dest.addr());
        io_data->mutable_udp_dest()->set_port(dest.port());

        // Serialize for the UDP packet
        std::string data;
        message.SerializeToString(&data);
        io_data->set_data(data);

        // Send it
        interthread().publish<web_portal_udp_out>(io_data);

        glog.is_debug2() && glog << group("main") << "Sent: " << io_data->ShortDebugString()
                                 << std::endl;
    }
}

void jaiabot::apps::WebPortal::handle_command(const jaiabot::protobuf::Command& command)
{
    using jaiabot::protobuf::Command;

    glog.is_debug2() && glog << group("main")
                             << "Sending command to hub_manager: " << command.ShortDebugString()
                             << std::endl;

    interprocess().publish<jaiabot::groups::hub_command_full>(command);

    if (command.has_plan())
    {
        active_mission_plans[command.bot_id()] = command.plan();
    }
}

void jaiabot::apps::WebPortal::handle_command_for_hub(
    const jaiabot::protobuf::CommandForHub& command_for_hub)
{
    glog.is_debug2() && glog << group("main") << "Sending command to hub_manager for hub: "
                             << command_for_hub.ShortDebugString() << std::endl;

    interprocess().publish<jaiabot::groups::hub_command_full>(command_for_hub);
}

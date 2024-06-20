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
constexpr goby::middleware::Group web_portal_udp_customer_in{"web_portal_udp_customer_in"};
constexpr goby::middleware::Group web_portal_udp_customer_out{"web_portal_udp_customer_out"};

class WebPortal : public zeromq::MultiThreadApplication<config::WebPortal>
{
  public:
    WebPortal();

  private:
    unordered_set<goby::middleware::protobuf::UDPEndPoint, UDPEndPointHash> client_endpoints;

    map<BotId, jaiabot::protobuf::MissionPlan> active_mission_plans;

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

    using UDPThread =
        goby::middleware::io::UDPOneToManyThread<web_portal_udp_in, web_portal_udp_out>;
    launch_thread<UDPThread>(cfg().udp_config());

    using UDPCustomerThread =
        goby::middleware::io::UDPPointToPointThread<web_portal_udp_customer_in,
                                                    web_portal_udp_customer_out>;
    if (cfg().has_udp_customer_config())
    {
        launch_thread<UDPCustomerThread>(cfg().udp_customer_config());
    }

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
        [this](const jaiabot::protobuf::BotStatus& bot_status)
        {
            glog.is_debug2() && glog << group("main")
                                     << "Received BotStatus: " << bot_status.ShortDebugString()
                                     << endl;

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

    // Subscribe to TaskPackets
    interprocess().subscribe<jaiabot::groups::task_packet>(
        [this](const jaiabot::protobuf::TaskPacket& task_packet) {
            jaiabot::protobuf::PortalToClientMessage message;
            *message.mutable_task_packet() = task_packet;

            send_message_to_client(message);
        });

    // Subscribe to MetaData
    interprocess().subscribe<jaiabot::groups::metadata>(
        [this](const jaiabot::protobuf::DeviceMetadata& metadata) {
            jaiabot::protobuf::PortalToClientMessage message;
            device_metadata_ = metadata;
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

        intervehicle().publish_dynamic(
            engineering_command,
            intervehicle::engineering_command_group(engineering_command.bot_id()),
            intervehicle::default_publisher<jaiabot::protobuf::Engineering>);
    }

    if (msg.has_command())
    {
        handle_command(msg.command());
    }

    if (msg.has_command_for_hub())
    {
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
                                 << device_metadata_.ShortDebugString() << endl;
        send_message_to_client(message);
    }
    else
    {
        glog.is_debug2() && glog << group("main")
                                 << "Query for metadata: " << device_metadata_.ShortDebugString()
                                 << endl;
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

    if (cfg().has_udp_customer_config())
    {
        // Send just task packet information for now
        if (message.has_task_packet())
        {
            auto io_data = make_shared<goby::middleware::protobuf::IOData>();
            io_data->mutable_udp_dest()->set_addr(cfg().udp_customer_config().remote_address());
            io_data->mutable_udp_dest()->set_port(cfg().udp_customer_config().remote_port());

            // Serialize for the UDP packet
            string data;
            message.task_packet().SerializeToString(&data);
            io_data->set_data(data);

            // Send it
            interthread().publish<web_portal_udp_customer_out>(io_data);
        }
    }
}

void jaiabot::apps::WebPortal::handle_command(const jaiabot::protobuf::Command& command)
{
    using jaiabot::protobuf::Command;

    glog.is_debug2() && glog << group("main")
                             << "Sending command to hub_manager: " << command.ShortDebugString()
                             << endl;

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
                             << command_for_hub.ShortDebugString() << endl;

    interprocess().publish<jaiabot::groups::hub_command_full>(command_for_hub);
}

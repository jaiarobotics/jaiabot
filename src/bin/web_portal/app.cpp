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

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/pid_control.pb.h"

#include <vector>

#define NOW (1000000000)
using string = std::string;
using goby::glog;
namespace si = boost::units::si;
namespace config = jaiabot::config;
namespace groups = jaiabot::groups;
namespace zeromq = goby::zeromq;
namespace middleware = goby::middleware;
using UDPEndPoint = goby::middleware::protobuf::UDPEndPoint;
using BotStatus = jaiabot::protobuf::BotStatus;
namespace REST = jaiabot::protobuf::rest;

namespace jaiabot
{
namespace apps
{

constexpr goby::middleware::Group web_portal_udp_in{"web_portal_udp_in"};
constexpr goby::middleware::Group web_portal_udp_out{"web_portal_udp_out"};

REST::BotStatus convert(const BotStatus& input_status) {
    REST::BotStatus bot_status;
    bot_status.set_bot_id(input_status.bot_id());
    bot_status.set_time(NOW);

    bot_status.mutable_location()->set_lat(input_status.location().lat());
    bot_status.mutable_location()->set_lon(input_status.location().lon());

    bot_status.set_depth(input_status.depth());

    bot_status.mutable_attitude()->set_heading(input_status.attitude().heading());

    return bot_status;
}

class WebPortal : public zeromq::MultiThreadApplication<config::WebPortal>
{
  public:
    WebPortal();

  private:
    UDPEndPoint dest;

    std::vector<REST::BotStatus> bot_statuses;

    void loop() override;

    void send(const REST::BotStatus& bot_status);
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
    : zeromq::MultiThreadApplication<config::WebPortal>(0 * si::hertz)
{
    glog.add_group("main", goby::util::Colors::yellow);

    using UDPThread = goby::middleware::io::UDPOneToManyThread<web_portal_udp_in, web_portal_udp_out>;
    launch_thread<UDPThread>(cfg().udp_config());

    glog.is_debug1() && glog << group("main") << "Web Portal Started" << std::endl;
    glog.is_debug1() && glog << group("main") << "Config:" << cfg().ShortDebugString() << std::endl;

    ///////////// INPUT from REST API
    interthread().subscribe<web_portal_udp_in>([this](const goby::middleware::protobuf::IOData& io_data) {
        auto command = REST::Command();

        glog.is_debug1() && glog << group("main") << "Data: " << io_data.ShortDebugString() << std::endl;

        if (command.ParseFromString(io_data.data())) {
            glog.is_debug1() && glog << group("main") << "Received command: " << command.ShortDebugString() << std::endl;

            intervehicle().publish<jaiabot::groups::pid_control>(command);
        }

        dest.set_addr(io_data.udp_src().addr());
        dest.set_port(io_data.udp_src().port());
    });

    dest.set_addr("");
    dest.set_port(0);

    // Set a default bot_status
    for (int i = 0; i < 16; i++) {
        REST::BotStatus bot_status;
        bot_status.set_bot_id(i);
        bot_status.set_time(NOW);

        bot_status.mutable_location()->set_lat(43 + rand() * 1.0 / RAND_MAX);
        bot_status.mutable_location()->set_lon(-72 + rand() * 1.0 / RAND_MAX);

        bot_status.set_depth(5);

        bot_status.mutable_attitude()->set_heading(rand() * 360.0 / RAND_MAX);

        bot_statuses.push_back(bot_status);
    }

    interprocess().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>([this](const jaiabot::protobuf::BotStatus& dccl_nav) {
        glog.is_debug2() && glog << group("main")
                                 << "Received DCCL nav: " << dccl_nav.ShortDebugString() << std::endl;

        auto bot_status = convert(dccl_nav);

        send(bot_status);
    });

}

void jaiabot::apps::WebPortal::loop()
{
    glog.is_verbose() && glog << group("main") << "Loop!" << std::endl;

    if (dest.port() != 0) {

        for (auto bot_status: bot_statuses) {
            send(bot_status);
        }
    }
}

void jaiabot::apps::WebPortal::send(const REST::BotStatus& bot_status) {
    if (dest.addr() == "") {
        return;
    }

    auto io_data = std::make_shared<goby::middleware::protobuf::IOData>();
    // udp_src { addr: "172.20.11.247" port: 40000 }
    io_data->mutable_udp_dest()->set_addr(dest.addr());
    io_data->mutable_udp_dest()->set_port(dest.port());

    // Serialize for the UDP packet
    string data;
    bot_status.SerializeToString(&data);
    io_data->set_data(data);

    // Send it
    interthread().publish<web_portal_udp_out>(io_data);

//    glog.is_debug1() && glog << group("main") << "Sent: " << io_data->ShortDebugString() << std::endl;
}

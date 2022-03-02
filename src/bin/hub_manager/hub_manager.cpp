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
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>

#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::HubManager>;

namespace jaiabot
{
namespace apps
{
class HubManager : public ApplicationBase
{
  public:
    HubManager();
    ~HubManager();

  private:
    void handle_bot_nav(const jaiabot::protobuf::BotStatus& dccl_nav);
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::HubManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::HubManager>(argc, argv));
}

jaiabot::apps::HubManager::HubManager()
{
    for (auto id : cfg().managed_bot_modem_id())
    {
        goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
        goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
            *subscriber_cfg.mutable_intervehicle();
        intervehicle_cfg.add_publisher_id(id);

        goby::middleware::Subscriber<jaiabot::protobuf::BotStatus> nav_subscriber(subscriber_cfg);

        intervehicle().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
            [this](const jaiabot::protobuf::BotStatus& dccl_nav) { handle_bot_nav(dccl_nav); },
            nav_subscriber);
    }
}

jaiabot::apps::HubManager::~HubManager()
{
    for (auto id : cfg().managed_bot_modem_id())
    {
        goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
        goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
            *subscriber_cfg.mutable_intervehicle();
        intervehicle_cfg.add_publisher_id(id);

        goby::middleware::Subscriber<jaiabot::protobuf::BotStatus> nav_subscriber(subscriber_cfg);

        intervehicle().unsubscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
            nav_subscriber);
    }
}

void jaiabot::apps::HubManager::handle_bot_nav(const jaiabot::protobuf::BotStatus& dccl_nav)
{
    glog.is_warn() && glog << group("bot_nav")
                           << "Received DCCL nav: " << dccl_nav.ShortDebugString() << std::endl;

    // republish for liaison / logger, etc.
    interprocess().publish<jaiabot::groups::bot_status>(dccl_nav);

    goby::middleware::frontseat::protobuf::NodeStatus node_status;

    node_status.set_name("BOT" + std::to_string(dccl_nav.bot_id()));

    node_status.set_time_with_units(dccl_nav.time_with_units());

    if (dccl_nav.attitude().has_heading())
        node_status.mutable_pose()->set_heading_with_units(
            dccl_nav.attitude().heading_with_units());

    if (dccl_nav.has_location())
    {
        node_status.mutable_global_fix()->set_lat_with_units(dccl_nav.location().lat_with_units());
        node_status.mutable_global_fix()->set_lon_with_units(dccl_nav.location().lon_with_units());
    }

    if (dccl_nav.has_speed())
        node_status.mutable_speed()->set_over_ground_with_units(
            dccl_nav.speed().over_ground_with_units());

    // publish for opencpn interface
    if (node_status.IsInitialized())
        interprocess().publish<goby::middleware::frontseat::groups::node_status>(node_status);
}

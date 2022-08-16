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
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/health/health.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/hub.pb.h"
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
    void loop() override
    {
        latest_hub_status_.set_time_with_units(
            goby::time::SystemClock::now<goby::time::MicroTime>());

        if (last_health_report_time_ + std::chrono::seconds(cfg().health_report_timeout_seconds()) <
            goby::time::SteadyClock::now())
        {
            glog.is_warn() && glog << "Timeout on health report" << std::endl;
            latest_hub_status_.set_health_state(goby::middleware::protobuf::HEALTH__FAILED);
            latest_hub_status_.clear_error();
            latest_hub_status_.add_error(protobuf::ERROR__NOT_RESPONDING__JAIABOT_HEALTH);
        }

        if (latest_hub_status_.IsInitialized())
        {
            glog.is_debug1() && glog << "Publishing hub status: "
                                     << latest_hub_status_.ShortDebugString() << std::endl;
            interprocess().publish<jaiabot::groups::hub_status>(latest_hub_status_);
        }
    }

    void handle_bot_nav(const jaiabot::protobuf::BotStatus& dccl_nav);
    void handle_dive_packet(const jaiabot::protobuf::DivePacket& dive_packet);

  private:
    jaiabot::protobuf::HubStatus latest_hub_status_;
    goby::time::SteadyClock::time_point last_health_report_time_{std::chrono::seconds(0)};
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::HubManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::HubManager>(argc, argv));
}

jaiabot::apps::HubManager::HubManager() : ApplicationBase(2 * si::hertz)
{
    latest_hub_status_.set_hub_id(cfg().hub_id());

    for (auto id : cfg().managed_bot_modem_id())
    {
        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::BotStatus> subscriber(subscriber_cfg);

            glog.is_debug1() && glog << "Subscribing to bot_status" << std::endl;

            intervehicle().subscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
                [this](const jaiabot::protobuf::BotStatus& dccl_nav) { handle_bot_nav(dccl_nav); },
                subscriber);
        }
        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg =
                cfg().dive_packet_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::DivePacket> subscriber(subscriber_cfg);

            glog.is_debug1() && glog << "Subscribing to dive_packet" << std::endl;

            intervehicle().subscribe<jaiabot::groups::dive_packet, jaiabot::protobuf::DivePacket>(
                [this](const jaiabot::protobuf::DivePacket& dive_packet) {
                    handle_dive_packet(dive_packet);
                },
                subscriber);
        }

        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::Engineering> subscriber(subscriber_cfg);

            glog.is_debug1() && glog << "Subscribing to engineering_status" << std::endl;

            intervehicle()
                .subscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::Engineering>(
                    [this](const jaiabot::protobuf::Engineering& input_engineering_status) {
                        glog.is_debug1() && glog << "Received input_engineering_status: "
                                                 << input_engineering_status.ShortDebugString()
                                                 << std::endl;

                        auto engineering_status = input_engineering_status;

                        // rewarp the time if needed
                        engineering_status.set_time_with_units(
                            goby::time::convert<goby::time::MicroTime>(
                                goby::time::SystemClock::warp(
                                    goby::time::convert<std::chrono::system_clock::time_point>(
                                        input_engineering_status.time_with_units()))));

                        interprocess().publish<jaiabot::groups::engineering_status>(
                            engineering_status);
                    },
                    subscriber);
        }
    }

    interprocess().subscribe<goby::middleware::groups::health_report>(
        [this](const goby::middleware::protobuf::VehicleHealth& vehicle_health) {
            last_health_report_time_ = goby::time::SteadyClock::now();
            jaiabot::health::populate_status_from_health(latest_hub_status_, vehicle_health);
        });

    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
            glog.is_debug1() && glog << "Received TimePositionVelocity update: "
                                     << tpv.ShortDebugString() << std::endl;

            if (tpv.has_location())
            {
                auto lat = tpv.location().lat_with_units(), lon = tpv.location().lon_with_units();
                latest_hub_status_.mutable_location()->set_lat_with_units(lat);
                latest_hub_status_.mutable_location()->set_lon_with_units(lon);
            }
        });
}

jaiabot::apps::HubManager::~HubManager()
{
    for (auto id : cfg().managed_bot_modem_id())
    {
        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::BotStatus> subscriber(subscriber_cfg);

            intervehicle().unsubscribe<jaiabot::groups::bot_status, jaiabot::protobuf::BotStatus>(
                subscriber);
        }
        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg =
                cfg().dive_packet_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::DivePacket> subscriber(subscriber_cfg);

            intervehicle().unsubscribe<jaiabot::groups::bot_status, jaiabot::protobuf::DivePacket>(
                subscriber);
        }

        {
            goby::middleware::protobuf::TransporterConfig subscriber_cfg = cfg().status_sub_cfg();
            goby::middleware::intervehicle::protobuf::TransporterConfig& intervehicle_cfg =
                *subscriber_cfg.mutable_intervehicle();
            intervehicle_cfg.add_publisher_id(id);

            goby::middleware::Subscriber<jaiabot::protobuf::Engineering> subscriber(subscriber_cfg);

            intervehicle()
                .unsubscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::Engineering>(
                    subscriber);
        }
    }
}

void jaiabot::apps::HubManager::handle_bot_nav(const jaiabot::protobuf::BotStatus& dccl_nav)
{
    glog.is_debug1() && glog << group("bot_nav")
                             << "Received DCCL nav: " << dccl_nav.ShortDebugString() << std::endl;

    // republish for liaison / logger, etc.
    interprocess().publish<jaiabot::groups::bot_status>(dccl_nav);

    goby::middleware::frontseat::protobuf::NodeStatus node_status;

    node_status.set_name("BOT" + std::to_string(dccl_nav.bot_id()));

    // rewarp the time if needed
    node_status.set_time_with_units(goby::time::convert<goby::time::MicroTime>(
        goby::time::SystemClock::warp(goby::time::convert<std::chrono::system_clock::time_point>(
            dccl_nav.time_with_units()))));

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

    if (dccl_nav.has_depth())
        node_status.mutable_global_fix()->set_depth_with_units(dccl_nav.depth_with_units());

    // publish for opencpn interface
    if (node_status.IsInitialized())
        interprocess().publish<goby::middleware::frontseat::groups::node_status>(node_status);
}

void jaiabot::apps::HubManager::handle_dive_packet(const jaiabot::protobuf::DivePacket& dive_packet)
{
    glog.is_debug1() && glog << group("dive_packet")
                             << "Received Dive packet: " << dive_packet.ShortDebugString()
                             << std::endl;

    // republish
    interprocess().publish<jaiabot::groups::dive_packet>(dive_packet);
}

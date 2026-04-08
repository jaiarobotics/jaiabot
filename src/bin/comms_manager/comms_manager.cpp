// Copyright 2025:
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
#include <goby/middleware/transport/intervehicle.h>
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/comms/comms.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/comms.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::CommsManager>;

namespace jaiabot
{
namespace apps
{
class CommsManager : public ApplicationBase
{
  public:
    CommsManager();

  private:
    void loop() override;
    void send_subscribe_request(const jaiabot::protobuf::IntervehicleSubscribeRequest& req);
    void publish_active_links();

  private:
    bool have_hub_id_{false};
    int hub_id_{0};

    struct Resubscriber
    {
        jaiabot::protobuf::Link link;
        goby::time::SteadyClock::time_point next_resubscribe;
        goby::time::SteadyClock::duration resubscribe_interval;
    };
    std::map<jaiabot::protobuf::Link, Resubscriber> resubscribers_;
    std::set<jaiabot::protobuf::Link> active_links_;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::CommsManager>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::CommsManager>(argc, argv));
}

jaiabot::apps::CommsManager::CommsManager() : ApplicationBase(1.0 * si::hertz)
{
    for (const jaiabot::config::CommsManager::SubscribeRule& rule : cfg().subscribe())
    {
        if (rule.subscribe_on_start())
        {
            jaiabot::protobuf::IntervehicleSubscribeRequest req;
            req.set_link(rule.link());
            send_subscribe_request(req);
        }

        if (rule.resubscribe())
        {
            goby::time::SteadyClock::duration resubscribe_interval =
                goby::time::convert_duration<goby::time::SteadyClock::duration>(
                    rule.resubscribe_interval_with_units());

            resubscribers_.insert(std::make_pair(
                rule.link(),
                Resubscriber({rule.link(), goby::time::SteadyClock::now() + resubscribe_interval,
                              resubscribe_interval})));
        }
    }

    interprocess().subscribe<goby::middleware::intervehicle::groups::subscription_report>(
        [this](const goby::middleware::intervehicle::protobuf::SubscriptionReport& sub_report)
        {
            auto bot_status_dccl_id = jaiabot::protobuf::BotStatus::DCCL_ID;
            if (sub_report.has_changed() &&
                sub_report.changed().dccl_id() == bot_status_dccl_id)
            {
                auto hub_modem_id = sub_report.changed().header().src();
                auto link =
                    jaiabot::comms::link_from_modem_id(hub_modem_id, cfg().subnet_mask());

                if (sub_report.changed().action() ==
                    goby::middleware::intervehicle::protobuf::Subscription::SUBSCRIBE)
                {
                    if (link != jaiabot::protobuf::LINK_UNKNOWN)
                    {
                        glog.is_verbose() &&
                            glog << "Hub subscribed to BotStatus on link: "
                                 << jaiabot::protobuf::Link_Name(link) << std::endl;
                        active_links_.insert(link);
                        publish_active_links();
                    }
                }
            }
        });
}

void jaiabot::apps::CommsManager::loop()
{
    auto now = goby::time::SteadyClock::now();
    for (auto& rp : resubscribers_)
    {
        auto& resubscriber = rp.second;
        if (now > resubscriber.next_resubscribe)
        {
            jaiabot::protobuf::IntervehicleSubscribeRequest req;
            req.set_link(resubscriber.link);
            send_subscribe_request(req);
            resubscriber.next_resubscribe += resubscriber.resubscribe_interval;
        }
    }
}

void jaiabot::apps::CommsManager::send_subscribe_request(
    const jaiabot::protobuf::IntervehicleSubscribeRequest& req)
{
    glog.is_debug1() && glog << "Sending subscribe request: " << req.ShortDebugString()
                             << std::endl;
    interprocess().publish<jaiabot::groups::intervehicle_subscribe_request>(req);
}

void jaiabot::apps::CommsManager::publish_active_links()
{
    jaiabot::protobuf::ActiveLinks active_links_msg;
    for (auto link : active_links_) active_links_msg.add_active_link(link);
    interprocess().publish<jaiabot::groups::bot_comms_status>(active_links_msg);
}

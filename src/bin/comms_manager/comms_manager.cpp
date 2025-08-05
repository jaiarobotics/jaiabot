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
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
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

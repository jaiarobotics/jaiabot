// Copyright 2022:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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
#include "jaiabot/messages/engineering.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase =
    goby::zeromq::SingleThreadApplication<jaiabot::config::JaiabotEngineering>;

namespace jaiabot
{
namespace apps
{
namespace groups
{
  std::unique_ptr<goby::middleware::DynamicGroup> engineering_command_this_bot;
}

class JaiabotEngineering : public ApplicationBase
{
  public:
    JaiabotEngineering();
    ~JaiabotEngineering();

  private:
    void loop() override;

    void handle_engineering_command(const jaiabot::protobuf::Engineering& command);

    // Engineering state to be published over intervehicle on a regular basis
    jaiabot::protobuf::Engineering latest_engineering;

    bool queried_for_status_{false};
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::JaiabotEngineering>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::JaiabotEngineering>(argc,
                                                                                          argv));
}

jaiabot::apps::JaiabotEngineering::JaiabotEngineering() : ApplicationBase(.2 * si::hertz)
{
    // create a specific dynamic group for this bot's ID so we only subscribe to our own commands
    groups::engineering_command_this_bot.reset(
        new goby::middleware::DynamicGroup(jaiabot::groups::engineering_command, cfg().bot_id()));

    latest_engineering.set_bot_id(cfg().bot_id());

    // Subscribe to app status updates
    {
        // jaiabot_pid_control
        interprocess()
            .subscribe<jaiabot::groups::engineering_status, jaiabot::protobuf::PIDControl>(
                [this](const jaiabot::protobuf::PIDControl& pid_control) {
                    latest_engineering.mutable_pid_control()->CopyFrom(pid_control);
                });

        interprocess().subscribe<jaiabot::groups::engineering_status>(
            [this](const jaiabot::protobuf::Engineering& engineering_status) {
                if (engineering_status.has_bot_status_rate())
                {
                    latest_engineering.set_bot_status_rate(engineering_status.bot_status_rate());
                }
                if (engineering_status.has_gps_requirements())
                {
                    if (engineering_status.gps_requirements().has_transit_hdop_req())
                    {
                        latest_engineering.mutable_gps_requirements()->set_transit_hdop_req(
                            engineering_status.gps_requirements().transit_hdop_req());
                    }
                    if (engineering_status.gps_requirements().has_transit_pdop_req())
                    {
                        latest_engineering.mutable_gps_requirements()->set_transit_pdop_req(
                            engineering_status.gps_requirements().transit_pdop_req());
                    }
                    if (engineering_status.gps_requirements().has_after_dive_hdop_req())
                    {
                        latest_engineering.mutable_gps_requirements()->set_after_dive_hdop_req(
                            engineering_status.gps_requirements().after_dive_hdop_req());
                    }
                    if (engineering_status.gps_requirements().has_after_dive_pdop_req())
                    {
                        latest_engineering.mutable_gps_requirements()->set_after_dive_pdop_req(
                            engineering_status.gps_requirements().after_dive_pdop_req());
                    }
                    if (engineering_status.gps_requirements().has_transit_gps_fix_checks())
                    {
                        latest_engineering.mutable_gps_requirements()->set_transit_gps_fix_checks(
                            engineering_status.gps_requirements().transit_gps_fix_checks());
                    }
                    if (engineering_status.gps_requirements().has_transit_gps_degraded_fix_checks())
                    {
                        latest_engineering.mutable_gps_requirements()
                            ->set_transit_gps_degraded_fix_checks(
                                engineering_status.gps_requirements()
                                    .transit_gps_degraded_fix_checks());
                    }
                    if (engineering_status.gps_requirements().has_after_dive_gps_fix_checks())
                    {
                        latest_engineering.mutable_gps_requirements()
                            ->set_after_dive_gps_fix_checks(
                                engineering_status.gps_requirements().after_dive_gps_fix_checks());
                    }
                }
                if (engineering_status.has_rf_disable_options())
                {
                    if (engineering_status.rf_disable_options().has_rf_disable())
                    {
                        latest_engineering.mutable_rf_disable_options()->set_rf_disable(
                            engineering_status.rf_disable_options().rf_disable());
                    }

                    if (engineering_status.rf_disable_options().has_rf_disable_timeout_mins())
                    {
                        latest_engineering.mutable_rf_disable_options()
                            ->set_rf_disable_timeout_mins(
                                engineering_status.rf_disable_options().rf_disable_timeout_mins());
                    }
                }
            });
    }

    // Intervehicle subscribe for commands from engineering
    {
        auto on_command_subscribed =
            [this](const goby::middleware::intervehicle::protobuf::Subscription& sub,
                   const goby::middleware::intervehicle::protobuf::AckData& ack) {
                glog.is_debug1() && glog << "Received acknowledgment:\n\t" << ack.ShortDebugString()
                                         << "\nfor subscription:\n\t" << sub.ShortDebugString()
                                         << std::endl;
            };

        // use vehicle ID as group for command
        auto do_set_group = [](const jaiabot::protobuf::Engineering& command) -> goby::middleware::Group {
            return goby::middleware::Group(command.bot_id());
        };

        goby::middleware::Subscriber<jaiabot::protobuf::Engineering> command_subscriber{
            cfg().command_sub_cfg(), do_set_group, on_command_subscribed};

        intervehicle().subscribe_dynamic<jaiabot::protobuf::Engineering>(
            [this](const jaiabot::protobuf::Engineering& command) {
                glog.is_debug1() && glog << "Engineering Command: " << command.ShortDebugString()
                                         << std::endl;

                handle_engineering_command(command);
                // republish for logging purposes
                interprocess().publish<jaiabot::groups::engineering_command>(command);
            },
            *groups::engineering_command_this_bot, command_subscriber);
    }
}

jaiabot::apps::JaiabotEngineering::~JaiabotEngineering()
{
    // unsubscribe for commands
    {
        auto on_command_unsubscribed =
            [this](const goby::middleware::intervehicle::protobuf::Subscription& sub,
                   const goby::middleware::intervehicle::protobuf::AckData& ack) {
                glog.is_debug1() && glog << "Received acknowledgment:\n\t" << ack.ShortDebugString()
                                         << "\nfor subscription:\n\t" << sub.ShortDebugString()
                                         << std::endl;
            };
        goby::middleware::Subscriber<jaiabot::protobuf::Engineering> command_subscriber{cfg().command_sub_cfg(),
                                                                           on_command_unsubscribed};

        intervehicle().unsubscribe_dynamic<jaiabot::protobuf::Engineering>(*groups::engineering_command_this_bot,
                                                              command_subscriber);
    }
}

void jaiabot::apps::JaiabotEngineering::loop()
{
    // DCCL uses the real system clock to encode time, so "unwarp" the time first
    auto unwarped_time = goby::time::convert<goby::time::MicroTime>(
        goby::time::SystemClock::unwarp(goby::time::SystemClock::now()));

    latest_engineering.set_time_with_units(unwarped_time);

    // Publish our latest engineering_status message, that has been gathered up from other apps
    if (latest_engineering.IsInitialized() && queried_for_status_)
    {
        queried_for_status_ = false;
        glog.is_debug1() && glog << "Publishing latest_engineering over intervehicle(): " << latest_engineering.ShortDebugString() << std::endl;
        intervehicle().publish<jaiabot::groups::engineering_status>(latest_engineering);
    }
}

void jaiabot::apps::JaiabotEngineering::handle_engineering_command(const jaiabot::protobuf::Engineering& command) {
    if (command.query_engineering_status())
    {
        queried_for_status_ = command.query_engineering_status();
    }

    // Republish the command on interprocess, so it gets logged, and apps can respond to the commands
    interprocess().publish<jaiabot::groups::engineering_command>(command);
}

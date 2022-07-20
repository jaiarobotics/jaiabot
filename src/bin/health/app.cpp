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
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::Health>;

namespace jaiabot
{
namespace apps
{
std::map<std::string, jaiabot::protobuf::Error> create_process_to_not_responding_error_map()
{
#define MAKE_ENTRY(APP_UCASE)                            \
    {                                                    \
        boost::to_lower_copy(std::string(#APP_UCASE)),   \
            protobuf::ERROR__NOT_RESPONDING__##APP_UCASE \
    }
    // only explicitly list external apps; apps built in this repo are added via -DJAIABOT_HEALTH_PROCESS_MAP_ENTRIES
    return {MAKE_ENTRY(GOBYD),       MAKE_ENTRY(GOBY_LIAISON), MAKE_ENTRY(GOBY_GPS),
            MAKE_ENTRY(GOBY_LOGGER), MAKE_ENTRY(GOBY_CORONER), JAIABOT_HEALTH_PROCESS_MAP_ENTRIES};
#undef MAKE_ENTRY
}

class Health : public ApplicationBase
{
  public:
    Health();

  private:
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    void restart_services() { system("systemctl restart jaiabot"); }
    void process_coroner_report(const goby::middleware::protobuf::VehicleHealth& vehicle_health);

  private:
    goby::time::SteadyClock::time_point next_check_time_;
    goby::middleware::protobuf::ThreadHealth last_health_;
    const std::map<std::string, jaiabot::protobuf::Error> process_to_not_responding_error_;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::Health>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::Health>(argc, argv));
}

jaiabot::apps::Health::Health()
    : ApplicationBase(1.0 * boost::units::si::hertz),
      next_check_time_(goby::time::SteadyClock::now() +
                       goby::time::convert_duration<goby::time::SteadyClock::duration>(
                           cfg().auto_restart_init_grace_period_with_units())),
      process_to_not_responding_error_(create_process_to_not_responding_error_map())
{
    // handle restart/reboot/shutdown commands since we run this app as root
    interprocess().subscribe<jaiabot::groups::powerstate_command>(
        [this](const protobuf::Command& command) {
            switch (command.type())
            {
                // most commands handled by jaiabot_mission_manager
                default: break;

                case protobuf::Command::REBOOT_COMPUTER:
                    glog.is_verbose() && glog << "Commanded to reboot computer. " << std::endl;
                    if (!cfg().ignore_powerstate_changes())
                        system("systemctl reboot");
                    break;
                case protobuf::Command::RESTART_ALL_SERVICES:
                    glog.is_verbose() && glog << "Commanded to restart jaiabot services. "
                                              << std::endl;
                    if (!cfg().ignore_powerstate_changes())
                        restart_services();
                    break;
                case protobuf::Command::SHUTDOWN_COMPUTER:
                    glog.is_verbose() && glog << "Commanded to shutdown computer. " << std::endl;
                    if (!cfg().ignore_powerstate_changes())
                        system("systemctl poweroff");
                    break;
            }
        });

    interprocess().subscribe<goby::middleware::groups::health_report>(
        [this](const goby::middleware::protobuf::VehicleHealth& vehicle_health) {
            process_coroner_report(vehicle_health);
        });
}

void jaiabot::apps::Health::process_coroner_report(
    const goby::middleware::protobuf::VehicleHealth& vehicle_health)
{
    if (vehicle_health.state() != goby::middleware::protobuf::HEALTH__FAILED)
    {
        // increase next check time every time we get an report where it's not FAILED
        next_check_time_ += goby::time::convert_duration<goby::time::SteadyClock::duration>(
            cfg().auto_restart_timeout_with_units());
    }

    last_health_.Clear();
    auto& jaiabot_health = *last_health_.MutableExtension(jaiabot::protobuf::jaiabot_thread);

    for (const auto& proc : vehicle_health.process())
    {
        if (proc.main().has_error() &&
            proc.main().error() == goby::middleware::protobuf::ERROR__PROCESS_DIED)
        {
            auto it = process_to_not_responding_error_.find(proc.main().name());
            if (it != process_to_not_responding_error_.end())
            {
                jaiabot_health.add_error(it->second);
            }
            else
            {
                glog.is_warn() &&
                    glog << "App: " << proc.main().name()
                         << " is not responding but has not been mapped to an ERROR enumeration"
                         << std::endl;
                jaiabot_health.add_error(protobuf::ERROR__NOT_RESPONDING__UNKNOWN_APP);
            }
        }
    }
}

void jaiabot::apps::Health::loop()
{
    if (cfg().auto_restart())
    {
        auto now = goby::time::SteadyClock::now();
        if (now > next_check_time_)
        {
            glog.is_warn() && glog << "Auto-restarting jaiabot services due to no HEALTH__OK "
                                      "or HEALTH__DEGRADED report in the last "
                                   << cfg().auto_restart_timeout() << " seconds" << std::endl;
            restart_services();
        }
    }
}

void jaiabot::apps::Health::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health = last_health_;
    health.set_name(this->app_name());

    // track
    health.set_state(goby::middleware::protobuf::HEALTH__OK);
}

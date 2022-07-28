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

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "system_thread.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::MultiThreadApplication<jaiabot::config::Health>;

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
    return {MAKE_ENTRY(GOBYD),
            MAKE_ENTRY(GOBY_LIAISON),
            MAKE_ENTRY(GOBY_GPS),
            MAKE_ENTRY(GOBY_LOGGER),
            MAKE_ENTRY(GOBY_CORONER),
            MAKE_ENTRY(GOBY_MOOS_GATEWAY),
            JAIABOT_HEALTH_PROCESS_MAP_ENTRIES};
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
    std::set<jaiabot::protobuf::Error> failed_services_;
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

    interprocess().subscribe<jaiabot::groups::systemd_report>(
        [this](const protobuf::SystemdStartReport& start_report) {
            glog.is_debug1() && glog << "Received start report: " << start_report.ShortDebugString()
                                     << std::endl;
            failed_services_.erase(start_report.clear_error());
            protobuf::SystemdReportAck ack;
            ack.set_error_ack(start_report.clear_error());
            interprocess().publish<groups::systemd_report_ack>(ack);
        });

    interprocess().subscribe<jaiabot::groups::systemd_report>(
        [this](const protobuf::SystemdStopReport& stop_report) {
            glog.is_debug1() && glog << "Received stop report: " << stop_report.ShortDebugString()
                                     << std::endl;
            if (stop_report.has_error())
            {
                failed_services_.insert(stop_report.error());
                protobuf::SystemdReportAck ack;
                ack.set_error_ack(stop_report.error());
                interprocess().publish<groups::systemd_report_ack>(ack);
            }
        });

    launch_thread<LinuxHardwareThread>(cfg().linux_hw());
    launch_thread<NTPStatusThread>(cfg().ntp());
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
    for (auto error : failed_services_)
        last_health_.MutableExtension(jaiabot::protobuf::jaiabot_thread)->add_error(error);

    for (const auto& proc : vehicle_health.process())
    {
        if (proc.main().has_error() &&
            proc.main().error() == goby::middleware::protobuf::ERROR__PROCESS_DIED)
        {
            auto it =
                process_to_not_responding_error_.find(boost::to_lower_copy(proc.main().name()));
            if (it != process_to_not_responding_error_.end())
            {
                last_health_.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(it->second);
            }
            else
            {
                glog.is_warn() &&
                    glog << "App: " << proc.main().name()
                         << " is not responding but has not been mapped to an ERROR enumeration"
                         << std::endl;
                last_health_.MutableExtension(jaiabot::protobuf::jaiabot_thread)
                    ->add_error(protobuf::ERROR__NOT_RESPONDING__UNKNOWN_APP);
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
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.MergeFrom(last_health_);
    health.set_name(this->app_name());
    health.set_state(goby::middleware::protobuf::HEALTH__OK);
}

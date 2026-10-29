// Copyright 2026:
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

#include <goby/middleware/protobuf/intervehicle.pb.h>
#include <goby/middleware/transport/intervehicle/groups.h>

#include "system_thread.h"

using goby::glog;
using goby::acomms::protobuf::ModemDriverStatus;

jaiabot::apps::IridiumStatusThread::IridiumStatusThread(
    const jaiabot::config::IridiumStatusConfig& cfg)
    : HealthMonitorThread(cfg, "iridium_status", 1.0 * boost::units::si::hertz)
{
    interprocess().subscribe<goby::middleware::intervehicle::groups::modem_report>(
        [this](const goby::middleware::intervehicle::protobuf::ModemReportWithLinkID& report)
        {
            if (report.link_modem_id() != this->cfg().link_modem_id())
                return;
            last_report_time_ = goby::time::SteadyClock::now();
            driver_status_ = report.data().driver_status();
        });
}

void jaiabot::apps::IridiumStatusThread::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(thread_name());
    auto health_state = goby::middleware::protobuf::HEALTH__OK;

    const bool report_timed_out =
        last_report_time_ + std::chrono::seconds(cfg().report_timeout_seconds()) <
        goby::time::SteadyClock::now();

    if (report_timed_out || driver_status_ != ModemDriverStatus::NOMINAL)
    {
        glog.is_warn() &&
            glog << "Iridium modem not responding ("
                 << (report_timed_out ? "no modem report"
                                      : ModemDriverStatus::Status_Name(driver_status_))
                 << ")" << std::endl;
        demote_health(health_state, goby::middleware::protobuf::HEALTH__DEGRADED);
        health.MutableExtension(jaiabot::protobuf::jaiabot_thread)
            ->add_warning(protobuf::WARNING__COMMS__IRIDIUM_NOT_RESPONDING);
    }

    health.set_state(health_state);
}

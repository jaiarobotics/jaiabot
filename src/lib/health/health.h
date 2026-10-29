// Copyright 2022:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Libraries
// ("The Jaia Libraries").
//
// The Jaia Libraries are free software: you can redistribute them and/or modify
// them under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2.1 of the License, or
// (at your option) any later version.
//
// The Jaia Libraries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the Jaia Libraries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_SRC_LIB_HEALTH_HEALTH_H
#define JAIABOT_SRC_LIB_HEALTH_HEALTH_H

#include <algorithm>
#include <map>
#include <string>

#include "jaiabot/messages/health.pb.h"

namespace jaiabot
{
namespace health
{
// Apps for sensors a bot can operate without, with the warning shown when one is not responding
inline const std::map<std::string, protobuf::Warning>& optional_apps()
{
    static const std::map<std::string, protobuf::Warning> apps{
        {"jaiabot_driver_salinity",
         protobuf::WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER},
        {"jaiabot_driver_tsys01",
         protobuf::WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER},
        {"jaiabot_driver_pam", protobuf::WARNING__NOT_RESPONDING__JAIABOT_PAM_DRIVER},
        {"jaiabot_ppk_logger", protobuf::WARNING__NOT_RESPONDING__UNKNOWN_APP}};
    return apps;
}

// The failure reporter's error for each optional app's service, with the warning shown instead
inline const std::map<protobuf::Error, protobuf::Warning>& optional_app_failures()
{
    static const std::map<protobuf::Error, protobuf::Warning> failures{
        {protobuf::ERROR__FAILED__PYTHON_JAIABOT_AS_EZO_EC,
         protobuf::WARNING__NOT_RESPONDING__JAIABOT_ATLAS_SCIENTIFIC_EZO_EC_DRIVER},
        {protobuf::ERROR__FAILED__PYTHON_JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER,
         protobuf::WARNING__NOT_RESPONDING__JAIABOT_TSYS01_TEMPERATURE_SENSOR_DRIVER},
        {protobuf::ERROR__FAILED__PYTHON_JAIABOT_PAM,
         protobuf::WARNING__NOT_RESPONDING__JAIABOT_PAM_DRIVER},
        {protobuf::ERROR__FAILED__JAIABOT_PPK, protobuf::WARNING__NOT_RESPONDING__UNKNOWN_APP}};
    return failures;
}

// goby_coroner's state, except that an optional app can only degrade the vehicle
inline goby::middleware::protobuf::HealthState
vehicle_health_state(const goby::middleware::protobuf::VehicleHealth& vehicle_health)
{
    auto state = goby::middleware::protobuf::HEALTH__OK;
    for (const auto& proc : vehicle_health.process())
    {
        auto proc_state = proc.main().state();
        if (optional_apps().count(proc.name()))
            proc_state = std::min(proc_state, goby::middleware::protobuf::HEALTH__DEGRADED);
        state = std::max(state, proc_state);
    }
    return state;
}

template <typename HuborBotStatus>
void populate_status_from_health(HuborBotStatus& status,
                                 const goby::middleware::protobuf::VehicleHealth& vehicle_health,
                                 bool truncate_to_fit_dccl = true)
{
    status.set_health_state(vehicle_health_state(vehicle_health));
    status.clear_error();
    status.clear_warning();

    if (status.health_state() != goby::middleware::protobuf::HEALTH__OK)
    {
        auto add_errors_and_warnings =
            [&status](const goby::middleware::protobuf::ThreadHealth& health) {
                const auto& jaiabot_health = health.GetExtension(jaiabot::protobuf::jaiabot_thread);
                for (auto error : jaiabot_health.error())
                    status.add_error(static_cast<jaiabot::protobuf::Error>(error));
                for (auto warning : jaiabot_health.warning())
                    status.add_warning(static_cast<jaiabot::protobuf::Warning>(warning));
            };

        for (const auto& proc : vehicle_health.process())
        {
            add_errors_and_warnings(proc.main());
            for (const auto& thread : proc.main().child()) add_errors_and_warnings(thread);

            auto optional = optional_apps().find(proc.name());
            if (optional != optional_apps().end() && proc.main().has_error() &&
                proc.main().error() == goby::middleware::protobuf::ERROR__PROCESS_DIED)
                status.add_warning(optional->second);
        }

        const int max_errors = HuborBotStatus::descriptor()
                                   ->FindFieldByName("error")
                                   ->options()
                                   .GetExtension(dccl::field)
                                   .max_repeat();

        const int max_warnings = HuborBotStatus::descriptor()
                                     ->FindFieldByName("warning")
                                     ->options()
                                     .GetExtension(dccl::field)
                                     .max_repeat();

        if (truncate_to_fit_dccl && status.error_size() > max_errors)
        {
            status.mutable_error()->Truncate(max_errors - 1);
            status.add_error(protobuf::ERROR__TOO_MANY_ERRORS_TO_REPORT_ALL);
        }
        if (truncate_to_fit_dccl && status.warning_size() > max_warnings)
        {
            status.mutable_warning()->Truncate(max_warnings - 1);
            status.add_warning(protobuf::WARNING__TOO_MANY_WARNINGS_TO_REPORT_ALL);
        }
    }
}

} // namespace health
} // namespace jaiabot

#endif

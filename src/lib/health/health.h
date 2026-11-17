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

// C++ Standard Library
#include <algorithm>
#include <map>
#include <set>
#include <string>

// Jaiabot
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

// VehicleHealth
//     - state
//     - process (repeated)
//         - main (ThreadHealth)
//             - error (repeated)
//             - warning (repeated)
//             - child (repeated ThreadHealth)

/**
 * @brief Get all errors from a ThreadHealth object, including child threads.
 *
 * @param thread_health The ThreadHealth object to extract errors from.
 * @return std::set<protobuf::Error> A set of all errors.
 */
inline std::set<protobuf::Error>
ThreadHealth_get_all_errors(const goby::middleware::protobuf::ThreadHealth& thread_health)
{
    std::set<protobuf::Error> errors;
    const auto& jaiabot_health = thread_health.GetExtension(jaiabot::protobuf::jaiabot_thread);

    for (const auto& error : jaiabot_health.error())
        errors.insert(static_cast<jaiabot::protobuf::Error>(error));

    for (const auto& child : thread_health.child())
    {
        auto child_errors = ThreadHealth_get_all_errors(child);
        errors.insert(child_errors.begin(), child_errors.end());
    }

    return errors;
}

/**
 * @brief Get all warnings from a ThreadHealth object, including child threads.
 *
 * @param thread_health The ThreadHealth object to extract warnings from.
 * @return std::set<protobuf::Warning> A set of all warnings.
 */
inline std::set<protobuf::Warning>
ThreadHealth_get_all_warnings(const goby::middleware::protobuf::ThreadHealth& thread_health)
{
    std::set<protobuf::Warning> warnings;
    const auto& jaiabot_health = thread_health.GetExtension(jaiabot::protobuf::jaiabot_thread);

    for (const auto& warning : jaiabot_health.warning())
        warnings.insert(static_cast<jaiabot::protobuf::Warning>(warning));

    for (const auto& child : thread_health.child())
    {
        auto child_warnings = ThreadHealth_get_all_warnings(child);
        warnings.insert(child_warnings.begin(), child_warnings.end());
    }

    return warnings;
}

/**
 * @brief Get all errors from a VehicleHealth object, including all processes and threads.
 *
 * @param vehicle_health The VehicleHealth object to extract errors from.
 * @return std::set<protobuf::Error> A set of all errors.
 */
inline std::set<protobuf::Error>
VehicleHealth_get_all_errors(const goby::middleware::protobuf::VehicleHealth& vehicle_health)
{
    std::set<protobuf::Error> errors;

    for (const auto& proc : vehicle_health.process())
    {
        // Skip optional apps that are not required for error aggregation
        if (optional_apps().find(proc.name()) != optional_apps().end())
            continue;

        auto proc_errors = ThreadHealth_get_all_errors(proc.main());
        errors.insert(proc_errors.begin(), proc_errors.end());
    }

    return errors;
}

/**
 * @brief Get all warnings from a VehicleHealth object, including all processes and threads.
 *
 * @param vehicle_health The VehicleHealth object to extract warnings from.
 * @return std::set<protobuf::Warning> A set of all warnings.
 */
inline std::set<protobuf::Warning>
VehicleHealth_get_all_warnings(const goby::middleware::protobuf::VehicleHealth& vehicle_health)
{
    std::set<protobuf::Warning> warnings;

    for (const auto& proc : vehicle_health.process())
    {
        // If an optional app has died, add its corresponding warning
        auto optional = optional_apps().find(proc.name());
        if (optional != optional_apps().end() &&
            proc.main().error() == goby::middleware::protobuf::ERROR__PROCESS_DIED)
        {
            warnings.insert(optional->second);
        }

        auto proc_warnings = ThreadHealth_get_all_warnings(proc.main());
        warnings.insert(proc_warnings.begin(), proc_warnings.end());
    }

    return warnings;
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
        // Add all errors and warnings from the health report to the status report
        for (const auto& error : VehicleHealth_get_all_errors(vehicle_health))
            status.add_error(error);
        for (const auto& warning : VehicleHealth_get_all_warnings(vehicle_health))
            status.add_warning(warning);

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

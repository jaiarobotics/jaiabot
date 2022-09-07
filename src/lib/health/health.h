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

#include "jaiabot/messages/health.pb.h"

namespace jaiabot
{
namespace health
{
template <typename HuborBotStatus>
void populate_status_from_health(HuborBotStatus& status,
                                 const goby::middleware::protobuf::VehicleHealth& vehicle_health,
                                 bool truncate_to_fit_dccl = true)
{
    status.set_health_state(vehicle_health.state());
    status.clear_error();
    status.clear_warning();

    if (vehicle_health.state() != goby::middleware::protobuf::HEALTH__OK)
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

// Copyright 2021:
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

#ifndef JAIABOT_CORE_SRC_LIB_GROUPS_H
#define JAIABOT_CORE_SRC_LIB_GROUPS_H

#include "goby/middleware/group.h"

namespace jaiabot
{
namespace groups
{
constexpr goby::middleware::Group example{"jaiabot::example"};

// lora
constexpr goby::middleware::Group lora_rx{"jaiabot::lora_rx"};
constexpr goby::middleware::Group lora_tx{"jaiabot::lora_tx"};
constexpr goby::middleware::Group lora_report{"jaiabot::lora_report"};

// sensors
constexpr goby::middleware::Group imu{"jaiabot::imu"};
constexpr goby::middleware::Group pressure_temperature{"jaiabot::pressure_temperature"};
constexpr goby::middleware::Group salinity{"jaiabot::salinity"};

// low control
constexpr goby::middleware::Group low_control{"jaiabot::low_control"};
constexpr goby::middleware::Group control_ack{"jaiabot::control_ack"};

// high control
constexpr goby::middleware::Group desired_setpoints{"jaiabot::desired_setpoints"};

// mission manager
constexpr goby::middleware::Group mission_report{"jaiabot::mission_report"};
constexpr goby::middleware::Group mission_ivp_behavior_update{
    "jaiabot::mission_ivp_behavior_update"};
constexpr goby::middleware::Group mission_ivp_behavior_report{
    "jaiabot::mission_ivp_behavior_report"};

// DCCL (intervehicle)
constexpr goby::middleware::Group bot_status{"jaiabot::bot_status",
                                             goby::middleware::Group::broadcast_group};
constexpr goby::middleware::Group hub_command{"jaiabot::hub_command",
                                              goby::middleware::Group::broadcast_group};
constexpr goby::middleware::Group dive_packet{"jaiabot::dive_packet",
                                              goby::middleware::Group::broadcast_group};
constexpr goby::middleware::Group engineering_command{"jaiabot::engineering_command",
                                              goby::middleware::Group::broadcast_group};
constexpr goby::middleware::Group engineering_status{"jaiabot::engineering_status",
                                              goby::middleware::Group::broadcast_group};

// Arduino
constexpr goby::middleware::Group arduino{"jaiabot::arduino"};

// Metadata
constexpr goby::middleware::Group metadata{"jaiabot::metadata"};

// MOOS
constexpr goby::middleware::Group moos{"jaiabot::moos"};

} // namespace groups
} // namespace jaiabot

#endif

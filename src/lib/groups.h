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

#include "jaiabot/version.h"

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
constexpr goby::middleware::Group pressure_adjusted{"jaiabot::pressure_adjusted"};
constexpr goby::middleware::Group salinity{"jaiabot::salinity"};
constexpr goby::middleware::Group echo{"jaiabot::echo"};

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
constexpr goby::middleware::Group powerstate_command{"jaiabot::powerstate_command"};
constexpr goby::middleware::Group mission_dive{"jaiabot::mission_dive"};

// hub manager
constexpr goby::middleware::Group hub_status{"jaiabot::hub_status"};

// health
constexpr goby::middleware::Group linux_hardware_status{"jaiabot::linux_hardware_status"};
constexpr goby::middleware::Group time_status{"jaiabot::time_status"};
constexpr goby::middleware::Group systemd_report{"jaiabot::systemd_report"};
constexpr goby::middleware::Group systemd_report_ack{"jaiabot::systemd_report_ack"};
constexpr goby::middleware::Group trinket_udp_in{"trinket_udp_in"};
constexpr goby::middleware::Group trinket_udp_out{"trinket_udp_out"};
constexpr goby::middleware::Group trinket_status{"jaiabot::trinket_status"};

// DCCL (intervehicle)
// The group used is an API version integer that allows us to check for incompatible
// versions of Jaiabot running on various hubs/bots
constexpr goby::middleware::Group bot_status{"jaiabot::bot_status",
                                             jaiabot::INTERVEHICLE_API_VERSION};
constexpr goby::middleware::Group hub_command{"jaiabot::hub_command"};
constexpr goby::middleware::Group task_packet{"jaiabot::task_packet",
                                              jaiabot::INTERVEHICLE_API_VERSION};
constexpr goby::middleware::Group engineering_command{"jaiabot::engineering_command"};

constexpr goby::middleware::Group engineering_status{"jaiabot::engineering_status",
                                                     jaiabot::INTERVEHICLE_API_VERSION};

constexpr goby::middleware::Group contact_update{"jaiabot::contact_update",
                                                 goby::middleware::Group::broadcast_group};

// DCCL (interprocess)
constexpr goby::middleware::Group hub_command_full{"jaiabot::hub_command_full"};

// Arduino
constexpr goby::middleware::Group arduino_from_pi{"jaiabot::arduino_from_pi"};
constexpr goby::middleware::Group arduino_to_pi{"jaiabot::arduino_to_pi"};
constexpr goby::middleware::Group arduino_debug{"jaiabot::arduino_debug"};

// Metadata
constexpr goby::middleware::Group metadata{"jaiabot::metadata"};

// MOOS
constexpr goby::middleware::Group moos{"jaiabot::moos"};
constexpr goby::middleware::Group helm_ivp{"jaiabot::helm_ivp"};

// Bot Comms
constexpr goby::middleware::Group intervehicle_subscribe_request{
    "jaiabot::intervehicle_subscribe_request"};

// simulator
constexpr goby::middleware::Group simulator_command{"jaiabot::simulator_command"};

} // namespace groups
} // namespace jaiabot

#endif

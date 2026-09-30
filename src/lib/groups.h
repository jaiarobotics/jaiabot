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

// sensors
constexpr goby::middleware::Group imu{"jaiabot::imu"};
constexpr goby::middleware::Group pressure_temperature{"jaiabot::pressure_temperature"};
constexpr goby::middleware::Group pressure_adjusted{"jaiabot::pressure_adjusted"};

constexpr goby::middleware::Group raw_salinity{"jaiabot::raw_salinity"};
constexpr goby::middleware::Group salinity{"jaiabot::salinity"};

constexpr goby::middleware::Group dissolved_oxygen{"jaiabot::dissolved_oxygen"};
constexpr goby::middleware::Group ph{"jaiabot::ph"};
constexpr goby::middleware::Group fluorometer{"jaiabot::fluorometer"};
constexpr goby::middleware::Group fluorometer_2{"jaiabot::fluorometer_2"};
constexpr goby::middleware::Group echo{"jaiabot::echo"};
constexpr goby::middleware::Group tsys01{"jaiabot::tsys01"};
constexpr goby::middleware::Group ctd{"jaiabot::ctd"};

constexpr goby::middleware::Group mcu_pb_data_out{
    "jaiabot::sensors::mcu_pb_data_out"}; // parsed SensorRequest
constexpr goby::middleware::Group mcu_pb_data_in{
    "jaiabot::sensors::mcu_pb_data_in"}; // parsed SensorData
constexpr goby::middleware::Group mcu_command{"jaiabot_sensors::mcu_command"};
constexpr goby::middleware::Group mcu_calibration_command{
    "jaiabot_sensors::mcu_calibration_command"};

constexpr goby::middleware::Group power_board_pb_data_out{
    "jaiabot::power_board::mcu_pb_data_out"}; // parsed PowerBoardRequest
constexpr goby::middleware::Group power_board_pb_data_in{
    "jaiabot::power_board::mcu_pb_data_in"}; // parsed PowerBoardMessage
constexpr goby::middleware::Group power_board_command{"jaiabot_power_board::mcu_command"};

constexpr goby::middleware::Group aml_in{"jaiabot::sensors::aml::in"};
constexpr goby::middleware::Group aml_out{"jaiabot::sensors::aml::out"};
constexpr goby::middleware::Group aml{"jaiabot::sensors::aml"};

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
constexpr goby::middleware::Group self_command{"jaiabot::self_command"};
constexpr goby::middleware::Group state_change{"jaiabot::state_change"};
constexpr goby::middleware::Group bot2bot_data{"jaiabot::bot2bot_data"};

// hub manager
constexpr goby::middleware::Group hub_status{"jaiabot::hub_status"};

// health
constexpr goby::middleware::Group linux_hardware_status{"jaiabot::linux_hardware_status"};
constexpr goby::middleware::Group time_status{"jaiabot::time_status"};
constexpr goby::middleware::Group systemd_report{"jaiabot::systemd_report"};
constexpr goby::middleware::Group systemd_report_ack{"jaiabot::systemd_report_ack"};
constexpr goby::middleware::Group motor_udp_in{"motor_udp_in"};
constexpr goby::middleware::Group motor_udp_out{"motor_udp_out"};
constexpr goby::middleware::Group motor_status{"jaiabot::motor_status"};
constexpr goby::middleware::Group motor_usage_report{"jaiabot::motor_usage_report"};

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

constexpr goby::middleware::Group hub2hub_data{"jaiabot::hub2hub_data",
                                               jaiabot::INTERVEHICLE_API_VERSION};

// DCCL (interprocess)
constexpr goby::middleware::Group hub_command_full{"jaiabot::hub_command_full"};
constexpr goby::middleware::Group hub_command_result{
    "jaiabot::hub_command_result"}; // ack or expire

// Arduino
constexpr goby::middleware::Group arduino_from_pi{"jaiabot::arduino_from_pi"};
constexpr goby::middleware::Group arduino_to_pi{"jaiabot::arduino_to_pi"};
constexpr goby::middleware::Group arduino_debug{"jaiabot::arduino_debug"};
constexpr goby::middleware::Group arduino_issue{"jaiabot::arduino_issue"};

// Metadata
constexpr goby::middleware::Group metadata{"jaiabot::metadata"};

// MOOS
constexpr goby::middleware::Group moos{"jaiabot::moos"};
constexpr goby::middleware::Group helm_ivp{"jaiabot::helm_ivp"};

// Bot Comms
constexpr goby::middleware::Group intervehicle_subscribe_request{
    "jaiabot::intervehicle_subscribe_request"};
constexpr goby::middleware::Group bot_comms_status{"jaiabot::bot_comms_status"};

// simulator
constexpr goby::middleware::Group simulator_command{"jaiabot::simulator_command"};

// web_portal
constexpr goby::middleware::Group web_portal("jaiabot::web_portal");
constexpr goby::middleware::Group remote_hub_command{"jaiabot::remote_hub_command"};

// Camera
constexpr goby::middleware::Group camera{"jaiabot::camera"};

// mission repeater
constexpr goby::middleware::Group script_step_begin{"jaiabot::script_step_begin"};
constexpr goby::middleware::Group script_step_end{"jaiabot::script_step_end"};

// PPK recorder
constexpr goby::middleware::Group ppk{"jaiabot::ppk"};

} // namespace groups
} // namespace jaiabot

#endif

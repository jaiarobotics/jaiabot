// Copyright 2023:
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

#ifndef JAIABOT_CORE_SRC_LIB_INTERVEHICLE_H
#define JAIABOT_CORE_SRC_LIB_INTERVEHICLE_H

#include "goby/middleware/group.h"
#include "goby/middleware/transport/publisher.h"

#include "jaiabot/comms/comms.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

namespace jaiabot
{
namespace intervehicle
{

// hub_command numeric group is based off bot id
inline goby::middleware::DynamicGroup hub_command_group(std::uint32_t bot_id)
{
    return goby::middleware::DynamicGroup(jaiabot::groups::hub_command,
                                          bot_id + jaiabot::INTERVEHICLE_API_VERSION *
                                                       jaiabot::comms::bot_id_total);
}

// given a bot id and the hub_command group numeric value, what API version is this subscriber (bot) using?
inline std::uint32_t api_version_from_hub_command(std::uint32_t bot_id,
                                                  std::uint32_t hub_command_group)
{
    return (hub_command_group - bot_id) / jaiabot::comms::bot_id_total;
}

// in case we ever exceed maximum valid Goby group
static_assert(jaiabot::INTERVEHICLE_API_VERSION * jaiabot::comms::bot_id_total +
                      jaiabot::comms::bot_id_max <=
                  goby::middleware::Group::maximum_valid_group,
              "jaiabot::INTERVEHICLE_API_VERSION exceeds maximum valid goby::middleware::Group "
              "value for hub_command");

inline goby::middleware::DynamicGroup engineering_command_group(std::uint32_t bot_id)
{
    return goby::middleware::DynamicGroup(jaiabot::groups::engineering_command,
                                          bot_id + jaiabot::INTERVEHICLE_API_VERSION *
                                                       jaiabot::comms::bot_id_total);
}

// as the group is inferred from jaiabot::INTERVEHICLE_API_VERSION and possibly the already-set bot_id field we don't need to set anything using the group function. However Goby requires one to exist for using non-broadcast groups, so we define a no-op group_func
template <typename DCCLMessage>
goby::middleware::Publisher<DCCLMessage>
    default_publisher({}, [](DCCLMessage&, const goby::middleware::Group&) {});

// for all non-command intervehicle groups, we use the INTERVEHICLE_API_VERSION directly as the group numeric value
template <typename DCCLMessage>
std::function<goby::middleware::Group(const DCCLMessage&)> default_subscriber_group_func(
    [](const DCCLMessage&) -> goby::middleware::Group
    { return goby::middleware::Group(jaiabot::INTERVEHICLE_API_VERSION); });

} // namespace intervehicle
} // namespace jaiabot

#endif

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

#ifndef JAIABOT_SRC_LIB_COMMS_COMMS_H
#define JAIABOT_SRC_LIB_COMMS_COMMS_H

#include <goby/acomms/acomms_constants.h>
#include <goby/util/sci.h>

#include "jaiabot/exception.h"
#include "jaiabot/messages/link.pb.h"
#include "jaiabot/messages/link_config.pb.h"

namespace jaiabot
{
namespace comms
{
constexpr int broadcast_modem_id{goby::acomms::BROADCAST_ID};
constexpr int hub_base_modem_id{1};
constexpr int bot0_base_modem_id{2};

constexpr int bot_id_min{0};
constexpr int bot_id_max{150};
constexpr int bot_id_total{bot_id_max - bot_id_min + 1};

constexpr int hub_id_min{0};
constexpr int hub_id_max{30};
constexpr int hub_id_total{hub_id_max - hub_id_min + 1};

// All bots use the same hub ID for bot-hub comms, regardless of the actual
// Hub ID - this allows multicast-style comms to the hub(s).
constexpr int default_hub_id{1};

inline void check_bot_id_bounds(int bot_id)
{
    if (bot_id < bot_id_min)
        throw(jaiabot::Exception("Bot ID " + std::to_string(bot_id) +
                                 " is less than Bot ID minimum"));

    if (bot_id > bot_id_max)
        throw(jaiabot::Exception("Bot ID " + std::to_string(bot_id) +
                                 " is greater than Bot ID maximum"));
}

inline void check_hub_id_bounds(int hub_id)
{
    if (hub_id < hub_id_min)
        throw(jaiabot::Exception("Hub ID " + std::to_string(hub_id) +
                                 " is less than Hub ID minimum"));

    if (hub_id > hub_id_max)
        throw(jaiabot::Exception("Hub ID " + std::to_string(hub_id) +
                                 " is greater than Hub ID maximum"));
}

inline int hub_modem_id(unsigned subnet_mask, jaiabot::protobuf::Link link, int hub_id = -1)
{
    unsigned num_modems_in_subnet = (0xFFFF ^ subnet_mask) + 1;
    if (link == jaiabot::protobuf::LINK_HUB2HUB)
    {
        if (hub_id == -1)
            throw(jaiabot::Exception("Hub ID must be set for LINK_HUB2HUB"));

        return hub_id + 1 + static_cast<int>(link) * num_modems_in_subnet;
    }
    else
    {
        return static_cast<int>(link) * num_modems_in_subnet + hub_base_modem_id;
    }
}

inline int hub_id_from_modem_id(int modem_id, unsigned subnet_mask, jaiabot::protobuf::Link link)
{
    if (link == jaiabot::protobuf::LINK_HUB2HUB)
    {
        int base_modem_id = modem_id & (~subnet_mask & 0xFFFF);
        int hub_id = base_modem_id - hub_base_modem_id;
        check_hub_id_bounds(hub_id);
        return hub_id;
    }
    else
    {
        throw(jaiabot::Exception(
            "Hub ID cannot be inferred from modem_id for links other than LINK_HUB2HUB"));
    }
}

inline int modem_id_from_bot_id(int bot_id, unsigned subnet_mask, jaiabot::protobuf::Link link)
{
    check_bot_id_bounds(bot_id);
    unsigned num_modems_in_subnet = (0xFFFF ^ subnet_mask) + 1;
    return static_cast<int>(link) * num_modems_in_subnet + bot_id + bot0_base_modem_id;
}

inline int bot_id_from_modem_id(int modem_id, unsigned subnet_mask)
{
    int base_modem_id = modem_id & (~subnet_mask & 0xFFFF);
    int bot_id = base_modem_id - bot0_base_modem_id;
    check_bot_id_bounds(bot_id);
    return bot_id;
}

inline jaiabot::protobuf::Link link_from_modem_id(int modem_id, unsigned subnet_mask)
{
    jaiabot::protobuf::Link link = jaiabot::protobuf::LINK_UNKNOWN;
    unsigned num_modems_in_subnet = (0xFFFF ^ subnet_mask) + 1;
    int link_id = (subnet_mask & modem_id) >> goby::util::ceil_log2(num_modems_in_subnet);
    if (jaiabot::protobuf::Link_IsValid(link_id))
        link = static_cast<jaiabot::protobuf::Link>(link_id);
    return link;
}

template <typename DCCLMessageWithLinkField>
void set_link_type(DCCLMessageWithLinkField& msg, int src_modem_id, unsigned subnet_mask)
{
    msg.set_link(link_from_modem_id(src_modem_id, subnet_mask));
}

inline goby::acomms::protobuf::DynamicBufferConfig
buffer_for_link(const jaiabot::protobuf::LinkAwareBufferConfig& link_aware_buffer,
                jaiabot::protobuf::Link link)
{
    auto buffer = link_aware_buffer.buffer_base();
    for (const auto& override_buffer : link_aware_buffer.buffer_override())
    {
        if (override_buffer.link() == link)
            buffer.MergeFrom(override_buffer.buffer());
    }
    return buffer;
}

} // namespace comms
} // namespace jaiabot

#endif

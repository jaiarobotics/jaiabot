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

#include "jaiabot/exception.h"

namespace jaiabot
{
namespace comms
{
constexpr int broadcast_modem_id{goby::acomms::BROADCAST_ID};
constexpr int hub_modem_id{1};
constexpr int bot0_modem_id{2};

constexpr int bot_id_min{0};
constexpr int bot_id_max{150};
constexpr int bot_id_total{bot_id_max - bot_id_min + 1};

constexpr int hub_id_min{0};
constexpr int hub_id_max{30};
constexpr int hub_id_total{hub_id_max - hub_id_min + 1};

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

inline int modem_id_from_bot_id(int bot_id)
{
    check_bot_id_bounds(bot_id);
    return bot_id + bot0_modem_id;
}

inline int bot_id_from_modem_id(int modem_id)
{
    int bot_id = modem_id - bot0_modem_id;

    if (bot_id > bot_id_max)
        throw(jaiabot::Exception("Modem ID " + std::to_string(modem_id) +
                                 " must be greater than bot0_modem_id"));
    check_bot_id_bounds(bot_id);
    return bot_id;
}

} // namespace comms
} // namespace jaiabot

#endif

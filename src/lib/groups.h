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

constexpr goby::middleware::Group lora_rx{"jaiabot::lora_rx"};
constexpr goby::middleware::Group lora_tx{"jaiabot::lora_tx"};
constexpr goby::middleware::Group lora_report{"jaiabot::lora_report"};
constexpr goby::middleware::Group bar30{"bar30"};

} // namespace groups
} // namespace jaiabot

#endif

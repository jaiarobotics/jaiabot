// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#ifndef JAIABOT_SRC_BIN_TOOL_ACTIONS_ADMIN_FLEET_SUPPORT_KEYS_H
#define JAIABOT_SRC_BIN_TOOL_ACTIONS_ADMIN_FLEET_SUPPORT_KEYS_H

#include <map>
#include <string>

namespace jaiabot
{
namespace apps
{
namespace admin
{
namespace fleet
{
struct SupportKey
{
    std::string wg_pubkey;
    int desktop_id;
};

// Keyed by the ID a support desktop is named by on the command line
const std::map<std::string, SupportKey>& support_keys();

} // namespace fleet
} // namespace admin
} // namespace apps
} // namespace jaiabot

#endif

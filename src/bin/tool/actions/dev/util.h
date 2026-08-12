// Copyright 2026:
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

#ifndef JAIABOT_SRC_BIN_TOOL_ACTIONS_DEV_UTIL_H
#define JAIABOT_SRC_BIN_TOOL_ACTIONS_DEV_UTIL_H

#include <stdexcept>
#include <string>

#include <boost/filesystem.hpp>

namespace jaiabot
{
namespace apps
{
namespace dev
{
// Walks up from the current directory looking for `relative_path` (e.g. "build.sh"), so these
// tools can be run from anywhere within a jaiabot source tree, not just its root.
inline boost::filesystem::path find_in_repo(const std::string& relative_path)
{
    for (auto dir = boost::filesystem::current_path(); !dir.empty(); dir = dir.parent_path())
    {
        auto candidate = dir / relative_path;
        if (boost::filesystem::exists(candidate))
            return candidate;
    }

    throw std::runtime_error(
        "Could not find " + relative_path +
        " in the current directory or any of its parents: this command must be run from within "
        "a jaiabot source tree");
}

} // namespace dev
} // namespace apps
} // namespace jaiabot
#endif

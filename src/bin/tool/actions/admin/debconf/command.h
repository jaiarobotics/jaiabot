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

#ifndef JAIABOT_SRC_BIN_TOOL_ACTIONS_ADMIN_DEBCONF_COMMAND_H
#define JAIABOT_SRC_BIN_TOOL_ACTIONS_ADMIN_DEBCONF_COMMAND_H

#include <string>
#include <vector>

#include <unistd.h>

#include <goby/util/debug_logger.h>

namespace jaiabot
{
namespace apps
{
namespace admin
{
namespace debconf
{
// jaia-debconf.sh is the single reader/writer of the debconf database; these
// actions are execvp front ends for it, following ctl.cpp, so that there is one
// implementation of debconf access.
//
// needs_root covers the actions that touch the database rather than just the
// package templates. debconf refuses non-root access, so rather than failing
// and telling the user to prepend sudo, do it for them - the alternative is
// that every read and write of a bot's own configuration is a typo away.
// Already-root callers exec directly, which keeps this working on images where
// sudo is not installed.
inline void exec_jaia_debconf(std::vector<std::string> args, bool needs_root)
{
    if (needs_root && geteuid() != 0)
        args.insert(args.begin(), "sudo");

    std::vector<char*> c_args;
    for (const auto& arg : args) { c_args.push_back(const_cast<char*>(arg.c_str())); }
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    goby::glog.is_die() && goby::glog << "ERROR executing " << c_args[0] << std::endl;
}

} // namespace debconf
} // namespace admin
} // namespace apps
} // namespace jaiabot
#endif

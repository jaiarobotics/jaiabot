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

#include <goby/util/debug_logger.h>

#include "jaiabot/utils/ip.h"

namespace jaiabot
{
namespace apps
{
namespace tool
{
inline std::string parse_host_ip_from_code(const std::string& host_code)
{
    try
    {
        jaiabot::ip::HostCode host;
        std::string host_ip = jaiabot::ip::host_code_to_addr(host_code, &host);

        if (!host.is_literal)
            goby::glog.is_verbose() && goby::glog << host_code << " ("
                                                  << jaiabot::ip::network_to_string(host.net)
                                                  << "): " << host_ip << std::endl;

        return host_ip;
    }
    catch (const std::exception& e)
    {
        goby::glog.is_die() && goby::glog << e.what() << std::endl;
        return "";
    }
}

constexpr const char* perm_authorized_keys_file = "/home/jaia/.ssh/authorized_keys";
constexpr const char* tmp_authorized_keys_file = "/etc/jaiabot/ssh/tmp_authorized_keys";
constexpr const char* hub_authorized_keys_file = "/etc/jaiabot/ssh/hub_authorized_keys";
constexpr const char* root_authorized_keys_file = "/etc/jaiabot/ssh/root_authorized_keys";
} // namespace tool
} // namespace apps
} // namespace jaiabot

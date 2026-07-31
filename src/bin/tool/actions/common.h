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

#include <regex>

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
    if (host_code == "self")
        return "::1";

    // pass through anything ending in .jaia.tech
    std::string jaia_tech_domain = ".jaia.tech";
    if (host_code.size() > jaia_tech_domain.size() &&
        host_code.substr(host_code.size() - jaia_tech_domain.size()) == jaia_tech_domain)
        return host_code;

    std::regex host_pattern("([bh])([0-9]+)([svc]?)(f([0-9]+))?|(ch)(f([0-9]+))?");
    std::smatch host_matches;

    if (std::regex_match(host_code, host_matches, host_pattern))
    {
        std::string node_code = host_matches[1];
        std::string node_id_str = host_matches[2];
        std::string net_code = host_matches[3];
        std::string fleet_id_str;

        const char* env_fleet_id = std::getenv("jaia_fleet_index");

        if (host_matches[5].matched)
            fleet_id_str = host_matches[5];
        else if (env_fleet_id)
            fleet_id_str = env_fleet_id;

        jaiabot::ip::Network net;
        if (net_code == "s")
            net = jaiabot::ip::Network::fleet_vpn;
        else if (net_code == "v")
            net = jaiabot::ip::Network::vfleet_vpn;
        else if (net_code == "c")
            net = jaiabot::ip::Network::cloudhub_vpn;
        else
            net = jaiabot::ip::Network::wlan;

        jaiabot::ip::NodeType node_type;
        int node_id = 0;

        if (node_code == "b")
        {
            node_type = jaiabot::ip::NodeType::bot;
            node_id = std::stoi(node_id_str);
        }
        else if (node_code == "h")
        {
            node_type = jaiabot::ip::NodeType::hub;
            node_id = std::stoi(node_id_str);
        }
        else if (host_matches[6] == "ch")
        {
            node_type = jaiabot::ip::NodeType::hub;
            node_id = 30;
            if (host_matches[8].matched)
                fleet_id_str = host_matches[8];
            net = jaiabot::ip::Network::cloudhub_vpn;
        }
        else
        {
            goby::glog.is_die() && goby::glog << "Host string is invalid: " << host_code
                                              << ". It must be b<bot_id>[sv]f<fleet_id> or "
                                                 "h<hub_id>[svc]f<fleet_id> or chf<fleet_id> "
                                                 "(for cloudhub)"
                                              << std::endl;
            return "";
        }

        if (fleet_id_str.empty())
            goby::glog.is_die() &&
                goby::glog << "Could not find fleet ID. Either specify as 'fN' suffix (e.g., b1f3) "
                              "or provide via environmental variable 'jaia_fleet_index'"
                           << std::endl;

        int fleet_id = std::stoi(fleet_id_str);

        try
        {
            std::string host_ip;
            // Use IPv4 for wlan and fleet_vpn; IPv6 for VPN-based networks
            if (net == jaiabot::ip::Network::wlan || net == jaiabot::ip::Network::fleet_vpn)
                host_ip = jaiabot::ip::ipv4_addr(fleet_id, net, node_type, node_id);
            else
                host_ip = jaiabot::ip::ipv6_addr(fleet_id, net, node_type, node_id);

            goby::glog.is_verbose() && goby::glog << host_code << " ("
                                                  << jaiabot::ip::network_to_string(net)
                                                  << "): " << host_ip << std::endl;
            return host_ip;
        }
        catch (const std::exception& e)
        {
            goby::glog.is_die() && goby::glog << "Failed to compute IP for host '" << host_code
                                              << "': " << e.what() << std::endl;
        }
    }
    else
    {
        goby::glog.is_die() && goby::glog << "Host string is invalid: " << host_code
                                          << ". It must be b<bot_id>[sv]f<fleet_id> or "
                                             "h<hub_id>[svc]f<fleet_id> or chf<fleet_id> "
                                             "(for cloudhub)"
                                          << std::endl;
    }
    return "";
}

constexpr const char* perm_authorized_keys_file = "/home/jaia/.ssh/authorized_keys";
constexpr const char* tmp_authorized_keys_file = "/etc/jaiabot/ssh/tmp_authorized_keys";
constexpr const char* hub_authorized_keys_file = "/etc/jaiabot/ssh/hub_authorized_keys";
constexpr const char* root_authorized_keys_file = "/etc/jaiabot/ssh/root_authorized_keys";
} // namespace tool
} // namespace apps
} // namespace jaiabot

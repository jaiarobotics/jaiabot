// Copyright 2025:
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

// Standalone, lightweight implementation of the "jaia ip" action.
//
// This intentionally does not link against goby or protobuf (and does not use <iostream>,
// std::regex, or Boost.Program_options) so that it starts up as quickly as possible: it is
// called repeatedly from non-interactive scripts (Ansible, shell, Python config generation).
// "jaia ip" simply execs this binary.

#include <cerrno>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <string>

#include "jaiabot/utils/ip.h"

namespace
{
const char* const usage_msg =
    "Usage: jaia_ip <host code>\n"
    "       jaia_ip --fleet_id <id> --ip_net <net> --ip_version <ipv4|ipv6>\n"
    "               [--query_type <addr|net>] [--node_type <type>] [--node_id <id>]\n"
    "               [--ipv6_base <address or CIDR>]\n"
    "\n"
    "Outputs the address or network for a given Jaia Bot, Hub or network.\n"
    "\n"
    "Host code mode:\n"
    "  b<bot_id>[svc]f<fleet_id>, h<hub_id>[svc]f<fleet_id>, or chf<fleet_id> (CloudHub).\n"
    "  The network suffix is 's' for the fleet (service) VPN, 'v' for the VirtualFleet VPN,\n"
    "  'c' for the CloudHub VPN, or omitted for the fleet WLAN.\n"
    "  The 'f<fleet_id>' suffix may be omitted if the 'jaia_fleet_index' environmental\n"
    "  variable is set.\n"
    "\n"
    "  Examples:\n"
    "    jaia_ip b4f10   IPv4 address for bot 4 on fleet 10 (WLAN)\n"
    "    jaia_ip h1f2    IPv4 address for hub 1 on fleet 2 (WLAN)\n"
    "    jaia_ip b5sf3   IPv4 address for bot 5 fleet 3 on the fleet (service) VPN\n"
    "    jaia_ip b5vf3   IPv6 address for bot 5 fleet 3 on the VirtualFleet VPN\n"
    "    jaia_ip chf3    IPv6 address for the CloudHub on fleet 3\n"
    "\n"
    "Explicit mode:\n"
    "  --query_type   addr (a single node address, the default) or net (a network CIDR block)\n"
    "  --node_type    bot, hub, desktop, gateway, or rpicam (required for addr queries)\n"
    "  --node_id      node ID (required for addr queries, except gateway)\n"
    "  --ip_net       wlan, fleet_vpn, vfleet_vpn, cloudhub_vpn, cloudhub_eth, vfleet_eth,\n"
    "                 vfleet_wlan, or vpc\n"
    "  --fleet_id     fleet ID (0-255)\n"
    "  --ip_version   ipv4 or ipv6\n"
    "  --ipv6_base    IPv6 base address or CIDR block, required for cloudhub_eth, vfleet_eth\n"
    "                 and vfleet_wlan with --ip_version ipv6\n"
    "\n"
    "  Examples:\n"
    "    jaia_ip --query_type addr --node_type bot --node_id 5 --fleet_id 3 --ip_net wlan "
    "--ip_version ipv4\n"
    "    jaia_ip --query_type net --fleet_id 3 --ip_net fleet_vpn --ip_version ipv4\n";

[[noreturn]] void die(const std::string& msg)
{
    std::fprintf(stderr, "jaia_ip: %s\n", msg.c_str());
    std::exit(1);
}

int parse_int(const std::string& flag, const std::string& value)
{
    errno = 0;
    char* end = nullptr;
    long parsed = std::strtol(value.c_str(), &end, 10);
    if (errno != 0 || end == value.c_str() || *end != '\0' || parsed < INT32_MIN ||
        parsed > INT32_MAX)
        die("invalid integer value for " + flag + ": " + value);
    return static_cast<int>(parsed);
}
} // namespace

int main(int argc, char* argv[])
{
    std::string host;
    std::string query_type = "addr";
    std::string node_type_str;
    std::string ip_net_str;
    std::string ip_version;
    std::string ipv6_base;
    int fleet_id = 0, node_id = 0;
    bool has_fleet_id = false, has_node_id = false;

    for (int i = 1; i < argc; ++i)
    {
        std::string arg = argv[i];

        if (arg == "-h" || arg == "--help")
        {
            std::fputs(usage_msg, stdout);
            return 0;
        }

        if (arg.compare(0, 2, "--") == 0)
        {
            // support both "--flag value" and "--flag=value"
            std::string flag = arg;
            std::string value;
            bool has_value = false;
            auto eq = arg.find('=');
            if (eq != std::string::npos)
            {
                flag = arg.substr(0, eq);
                value = arg.substr(eq + 1);
                has_value = true;
            }
            else if (i + 1 < argc)
            {
                value = argv[i + 1];
                has_value = true;
                ++i;
            }

            if (flag == "--binary")
            {
                // ignored: passed by the 'jaia' tool when exec'ing an external command
                continue;
            }

            if (!has_value)
                die("missing value for " + flag);

            if (flag == "--query_type")
                query_type = value;
            else if (flag == "--node_type")
                node_type_str = value;
            else if (flag == "--ip_net")
                ip_net_str = value;
            else if (flag == "--ip_version")
                ip_version = value;
            else if (flag == "--ipv6_base")
                ipv6_base = value;
            else if (flag == "--host")
                host = value;
            else if (flag == "--fleet_id")
            {
                fleet_id = parse_int(flag, value);
                has_fleet_id = true;
            }
            else if (flag == "--node_id")
            {
                node_id = parse_int(flag, value);
                has_node_id = true;
            }
            else
                die("unknown flag: " + flag + "\n\n" + usage_msg);
        }
        else if (host.empty())
        {
            host = arg;
        }
        else
        {
            die("unexpected argument: " + arg + "\n\n" + usage_msg);
        }
    }

    try
    {
        std::string result;

        if (!host.empty())
        {
            result = jaiabot::ip::host_code_to_addr(host);
        }
        else
        {
            if (!has_fleet_id)
                die("--fleet_id is required in explicit mode");
            if (ip_net_str.empty())
                die("--ip_net is required in explicit mode");
            if (ip_version.empty())
                die("--ip_version is required in explicit mode");
            if (ip_version != "ipv4" && ip_version != "ipv6")
                die("--ip_version must be ipv4 or ipv6");

            bool is_ipv4 = ip_version == "ipv4";
            auto ip_net = jaiabot::ip::network_from_string(ip_net_str);

            if (query_type == "addr")
            {
                if (node_type_str.empty())
                    die("--node_type is required for addr queries");

                auto node_type = jaiabot::ip::node_type_from_string(node_type_str);

                // gateway always uses node_id=0; all other types require --node_id
                if (node_type == jaiabot::ip::NodeType::gateway)
                    node_id = 0;
                else if (!has_node_id)
                    die("--node_id is required for addr queries (except gateway)");

                result = is_ipv4 ? jaiabot::ip::ipv4_addr(fleet_id, ip_net, node_type, node_id)
                                 : jaiabot::ip::ipv6_addr(fleet_id, ip_net, node_type, node_id,
                                                          ipv6_base);
            }
            else if (query_type == "net")
            {
                result = is_ipv4 ? jaiabot::ip::ipv4_net(fleet_id, ip_net)
                                 : jaiabot::ip::ipv6_net(fleet_id, ip_net, ipv6_base);
            }
            else
            {
                die("--query_type must be addr or net");
            }
        }

        std::printf("%s\n", result.c_str());
    }
    catch (const std::exception& e)
    {
        die(std::string("IP computation failed: ") + e.what());
    }

    return 0;
}

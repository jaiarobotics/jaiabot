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
#include <utility>

#include "jaiabot/utils/ip.h"

namespace
{
const char* const usage_msg =
    "Usage: jaia_ip <host code> [--ip_version <ipv4|ipv6|auto>]\n"
    "       jaia_ip --fleet_id <id> --ip_net <net> [--ip_version <ipv4|ipv6|auto>]\n"
    "               [--query_type <addr|net>] [--node_type <type>] [--node_id <id>]\n"
    "               [--ipv6_base <address or CIDR>]\n"
    "\n"
    "Outputs the address or network for a given Jaia Bot, Hub or network.\n"
    "\n"
    "Host code mode:\n"
    "  b<bot_id>[svc]f<fleet_id>, h<hub_id>[svc]f<fleet_id>, or chf<fleet_id> (CloudHub).\n"
    "  The network suffix is 's' for the fleet (service) VPN, 'v' for the VirtualFleet VPN,\n"
    "  'c' for the CloudHub VPN, or omitted for the fleet WLAN.\n"
    "  The 'f<fleet_id>' suffix may be omitted when the fleet can be determined locally:\n"
    "  either from the 'jaia_fleet_id' environmental variable (set in login shells by\n"
    "  /etc/profile.d/jaia.sh) or from a hostname of the form '<type><id>-fleet<fleet_id>'.\n"
    "\n"
    "  The address is given in whichever IP version the fleet uses on the network the code\n"
    "  names; --ip_version asks for one in particular. None of the explicit mode flags below\n"
    "  can be given with a host code, which already names the node, its fleet and its network.\n"
    "\n"
    "  Examples:\n"
    "    jaia_ip b4f10   IPv4 address for bot 4 on fleet 10 (WLAN)\n"
    "    jaia_ip h1f2    IPv4 address for hub 1 on fleet 2 (WLAN)\n"
    "    jaia_ip b5sf3   IPv4 address for bot 5 fleet 3 on the fleet (service) VPN\n"
    "    jaia_ip b5vf3   IPv6 address for bot 5 fleet 3 on the VirtualFleet VPN\n"
    "    jaia_ip chf3    IPv6 address for the CloudHub on fleet 3\n"
    "    jaia_ip b4f1000 IPv6 address for bot 4 on fleet 1000 (WLAN), an IPv6 fleet\n"
    "    jaia_ip b5sf3 --ip_version ipv6\n"
    "                    the IPv6 address of that same bot on the fleet VPN\n"
    "\n"
    "Explicit mode:\n"
    "  --query_type   addr (a single node address, the default) or net (a network CIDR block)\n"
    "  --node_type    bot, hub, desktop, gateway, or rpicam (required for addr queries)\n"
    "  --node_id      node ID (required for addr queries, except gateway)\n"
    "  --ip_net       wlan, fleet_vpn, vfleet_vpn, cloudhub_vpn, cloudhub_eth, vfleet_eth,\n"
    "                 vfleet_wlan, or vpc\n"
    "  --fleet_id     fleet ID: 0-250 are addressed with IPv4 on the fleet WLAN and fleet VPN,\n"
    "                 251-4000 with IPv6 on every network\n"
    "  --ip_version   ipv4, ipv6, or auto (the default): whichever version the given fleet uses\n"
    "                 on the given network\n"
    "  --ipv6_base    IPv6 base address or CIDR block, required for cloudhub_eth, vfleet_eth\n"
    "                 and vfleet_wlan with --ip_version ipv6\n"
    "\n"
    "  Examples:\n"
    "    jaia_ip --query_type addr --node_type bot --node_id 5 --fleet_id 3 --ip_net wlan\n"
    "    jaia_ip --query_type net --fleet_id 3 --ip_net fleet_vpn\n";

[[noreturn]] void die(const std::string& msg)
{
    std::fprintf(stderr, "jaia_ip: %s\n\n%s\n", msg.c_str(), usage_msg);
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
    std::string ip_version_str = "auto";
    std::string ipv6_base;
    int fleet_id = 0, node_id = 0;
    bool has_fleet_id = false, has_node_id = false, has_query_type = false;

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
            auto eq = arg.find('=');
            std::string flag = eq != std::string::npos ? arg.substr(0, eq) : arg;

            if (flag == "--binary")
            {
                // ignored: passed by the 'jaia' tool when exec'ing an external command
                if (eq == std::string::npos)
                    ++i; // skip the value
                continue;
            }

            std::string value;
            bool has_value = false;
            if (eq != std::string::npos)
            {
                value = arg.substr(eq + 1);
                has_value = true;
            }
            else if (i + 1 < argc)
            {
                value = argv[i + 1];
                has_value = true;
                ++i;
            }

            if (!has_value)
                die("missing value for " + flag);

            if (flag == "--query_type")
            {
                query_type = value;
                has_query_type = true;
            }
            else if (flag == "--node_type")
                node_type_str = value;
            else if (flag == "--ip_net")
                ip_net_str = value;
            else if (flag == "--ip_version")
                ip_version_str = value;
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
                die("unknown flag: " + flag);
        }
        else if (host.empty())
        {
            host = arg;
        }
        else
        {
            die("unexpected argument: " + arg);
        }
    }

    if (ip_version_str != "ipv4" && ip_version_str != "ipv6" && ip_version_str != "auto")
        die("--ip_version must be ipv4, ipv6 or auto");

    if (!host.empty())
    {
        // a host code already names the node, its fleet and its network, so silently ignoring
        // the flags that give those separately would answer a question that was not asked
        const std::pair<const char*, bool> explicit_mode_flags[] = {
            {"--query_type", has_query_type}, {"--node_type", !node_type_str.empty()},
            {"--node_id", has_node_id},       {"--ip_net", !ip_net_str.empty()},
            {"--fleet_id", has_fleet_id},     {"--ipv6_base", !ipv6_base.empty()}};

        for (const auto& explicit_mode_flag : explicit_mode_flags)
            if (explicit_mode_flag.second)
                die(std::string(explicit_mode_flag.first) + " cannot be given with the host code " +
                    host);
    }

    try
    {
        std::string result;

        if (!host.empty())
        {
            auto parsed = jaiabot::ip::parse_host_code(host);
            result = ip_version_str == "auto"
                         ? jaiabot::ip::host_code_addr(parsed)
                         : jaiabot::ip::host_code_addr(parsed, ip_version_str == "ipv4"
                                                                   ? jaiabot::ip::IPVersion::ipv4
                                                                   : jaiabot::ip::IPVersion::ipv6);
        }
        else
        {
            if (!has_fleet_id)
                die("--fleet_id is required in explicit mode");
            if (ip_net_str.empty())
                die("--ip_net is required in explicit mode");

            auto ip_net = jaiabot::ip::network_from_string(ip_net_str);

            bool is_ipv4 = ip_version_str == "auto" ? jaiabot::ip::ip_version(fleet_id, ip_net) ==
                                                          jaiabot::ip::IPVersion::ipv4
                                                    : ip_version_str == "ipv4";

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

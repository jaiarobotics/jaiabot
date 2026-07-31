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

#ifndef JAIABOT_UTILS_IP_H
#define JAIABOT_UTILS_IP_H

#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>

#include <boost/asio/ip/address_v4.hpp>
#include <boost/asio/ip/address_v6.hpp>
#include <boost/system/error_code.hpp>

namespace jaiabot
{
namespace ip
{

// Node types - limited by IPv4 addresses and definitions in jaiabot/src/lib/comms/comms.h
enum class NodeType
{
    bot,
    hub,
    desktop,
    gateway,
    rpicam,
};

// Network types
enum class Network
{
    wlan,
    fleet_vpn,
    vfleet_vpn,
    cloudhub_vpn,
    cloudhub_eth,
    vfleet_eth,
    vfleet_wlan,
    vpc,
};

// Node ID valid ranges
constexpr int bot_id_min = 0, bot_id_max = 150;
constexpr int hub_id_min = 0, hub_id_max = 30;
constexpr int desktop_id_min = 1, desktop_id_max = 9;
constexpr int gateway_id_min = 0, gateway_id_max = 0;
constexpr int rpicam_id_min = 0, rpicam_id_max = 49;
constexpr int fleet_id_min = 0, fleet_id_max = 255;

inline std::string node_type_to_string(NodeType node)
{
    switch (node)
    {
        case NodeType::bot: return "bot";
        case NodeType::hub: return "hub";
        case NodeType::desktop: return "desktop";
        case NodeType::gateway: return "gateway";
        case NodeType::rpicam: return "rpicam";
    }
    throw std::invalid_argument("Unknown node type");
}

inline NodeType node_type_from_string(const std::string& s)
{
    if (s == "bot")
        return NodeType::bot;
    if (s == "hub")
        return NodeType::hub;
    if (s == "desktop")
        return NodeType::desktop;
    if (s == "gateway")
        return NodeType::gateway;
    if (s == "rpicam")
        return NodeType::rpicam;
    throw std::invalid_argument("Unknown node type: " + s);
}

inline std::string network_to_string(Network net)
{
    switch (net)
    {
        case Network::wlan: return "wlan";
        case Network::fleet_vpn: return "fleet_vpn";
        case Network::vfleet_vpn: return "vfleet_vpn";
        case Network::cloudhub_vpn: return "cloudhub_vpn";
        case Network::cloudhub_eth: return "cloudhub_eth";
        case Network::vfleet_eth: return "vfleet_eth";
        case Network::vfleet_wlan: return "vfleet_wlan";
        case Network::vpc: return "vpc";
    }
    throw std::invalid_argument("Unknown network");
}

inline Network network_from_string(const std::string& s)
{
    if (s == "wlan")
        return Network::wlan;
    if (s == "fleet_vpn")
        return Network::fleet_vpn;
    if (s == "vfleet_vpn")
        return Network::vfleet_vpn;
    if (s == "cloudhub_vpn")
        return Network::cloudhub_vpn;
    if (s == "cloudhub_eth")
        return Network::cloudhub_eth;
    if (s == "vfleet_eth")
        return Network::vfleet_eth;
    if (s == "vfleet_wlan")
        return Network::vfleet_wlan;
    if (s == "vpc")
        return Network::vpc;
    throw std::invalid_argument("Unknown network: " + s);
}

// Valid [min, max] node id range for a given node type
inline std::pair<int, int> node_id_range(NodeType node)
{
    switch (node)
    {
        case NodeType::bot: return {bot_id_min, bot_id_max};
        case NodeType::hub: return {hub_id_min, hub_id_max};
        case NodeType::desktop: return {desktop_id_min, desktop_id_max};
        case NodeType::gateway: return {gateway_id_min, gateway_id_max};
        case NodeType::rpicam: return {rpicam_id_min, rpicam_id_max};
    }
    throw std::invalid_argument("Unknown node type");
}

inline void validate_fleet_id(int fleet_id)
{
    if (fleet_id < fleet_id_min || fleet_id > fleet_id_max)
        throw std::invalid_argument("fleet_id " + std::to_string(fleet_id) +
                                    " is not in range: " + std::to_string(fleet_id_min) + " to " +
                                    std::to_string(fleet_id_max));
}

inline void validate_node_id(NodeType node, int node_id)
{
    auto range = node_id_range(node);
    if (node_id < range.first || node_id > range.second)
        throw std::invalid_argument("node_id " + std::to_string(node_id) + " for " +
                                    node_type_to_string(node) +
                                    " is not in range: " + std::to_string(range.first) + " to " +
                                    std::to_string(range.second));
}

namespace detail
{

inline boost::asio::ip::address_v4 ipv4_base(int fleet_id, Network net)
{
    using namespace boost::asio::ip;
    switch (net)
    {
        case Network::wlan:
        case Network::vfleet_wlan:
            // 10.23.{fleet_id}.0
            return make_address_v4(
                address_v4::bytes_type{10, 23, static_cast<uint8_t>(fleet_id), 0});
        case Network::fleet_vpn:
            // 172.23.{fleet_id}.0
            return make_address_v4(
                address_v4::bytes_type{172, 23, static_cast<uint8_t>(fleet_id), 0});
        case Network::cloudhub_eth:
            // 10.23.255.0
            return make_address_v4(address_v4::bytes_type{10, 23, 255, 0});
        case Network::vfleet_eth:
            // 10.23.254.0
            return make_address_v4(address_v4::bytes_type{10, 23, 254, 0});
        case Network::vpc:
            // 10.23.0.0
            return make_address_v4(address_v4::bytes_type{10, 23, 0, 0});
        default: throw std::invalid_argument("No IPv4 base for network: " + network_to_string(net));
    }
}

inline int ipv4_prefix_len(Network net)
{
    switch (net)
    {
        case Network::wlan:
        case Network::fleet_vpn:
        case Network::cloudhub_eth:
        case Network::vfleet_eth:
        case Network::vfleet_wlan: return 24;
        case Network::vpc: return 16;
        default:
            throw std::invalid_argument("No IPv4 prefix for network: " + network_to_string(net));
    }
}

inline uint32_t ipv4_node_offset(NodeType node, int node_id)
{
    switch (node)
    {
        case NodeType::hub: return static_cast<uint32_t>(10 + node_id);
        case NodeType::bot: return static_cast<uint32_t>(100 + node_id);
        case NodeType::rpicam: return static_cast<uint32_t>(50 + node_id);
        case NodeType::gateway: return 1; // node_id is ignored for gateway
        case NodeType::desktop:
            throw std::invalid_argument("desktop node is not supported for ipv4");
    }
    throw std::invalid_argument("Unknown node type for IPv4");
}

// Add a 64-bit offset to an IPv6 address (full 128-bit arithmetic via carry)
inline boost::asio::ip::address_v6 ipv6_add_offset(boost::asio::ip::address_v6 addr,
                                                   uint64_t offset)
{
    auto bytes = addr.to_bytes();
    uint64_t carry = offset;
    for (int i = 15; i >= 0 && carry > 0; --i)
    {
        uint64_t sum = static_cast<uint64_t>(bytes[i]) + (carry & 0xFF);
        bytes[i] = static_cast<uint8_t>(sum & 0xFF);
        carry = (carry >> 8) + (sum >> 8);
    }
    return boost::asio::ip::address_v6(bytes);
}

// Add offset*2^64 to an IPv6 address, that is, add offset to the upper 64 bits. Byte index 7 is
// the least significant byte of the upper 64 bits.
inline boost::asio::ip::address_v6 ipv6_add_subnet_offset(boost::asio::ip::address_v6 addr,
                                                          uint64_t offset)
{
    auto bytes = addr.to_bytes();
    uint64_t carry = offset;
    for (int i = 7; i >= 0 && carry > 0; --i)
    {
        uint64_t sum = static_cast<uint64_t>(bytes[i]) + (carry & 0xFF);
        bytes[i] = static_cast<uint8_t>(sum & 0xFF);
        carry = (carry >> 8) + (sum >> 8);
    }
    return boost::asio::ip::address_v6(bytes);
}

// Zero out the lower 64 bits (host portion of a /64 network)
inline boost::asio::ip::address_v6 ipv6_mask64(boost::asio::ip::address_v6 addr)
{
    auto bytes = addr.to_bytes();
    for (int i = 8; i < 16; ++i) bytes[i] = 0;
    return boost::asio::ip::address_v6(bytes);
}

inline boost::asio::ip::address_v6 parse_ipv6(const std::string& s)
{
    // accept either a bare address ("2001:db8::") or a CIDR block ("2001:db8::/56"), in which
    // case the network address (first address in the block) is used
    std::string addr_str = s.substr(0, s.find('/'));
    boost::system::error_code ec;
    auto addr = boost::asio::ip::make_address_v6(addr_str, ec);
    if (ec)
        throw std::invalid_argument("Invalid IPv6 address: " + s + " (" + ec.message() + ")");
    return addr;
}

// Build the IPv6 base address for a given network/fleet
// ipv6_base_str is required only for cloudhub_eth, vfleet_eth, vfleet_wlan
inline boost::asio::ip::address_v6 ipv6_base(int fleet_id, Network net,
                                             const std::string& ipv6_base_str = "")
{
    auto make_prefix_addr = [&](const std::string& prefix)
    {
        std::ostringstream ss;
        ss << prefix << std::hex << fleet_id << "::";
        return parse_ipv6(ss.str());
    };

    auto get_base_from_arg = [&]()
    {
        if (ipv6_base_str.empty())
            throw std::invalid_argument("--ipv6_base is required for network: " +
                                        network_to_string(net));
        return parse_ipv6(ipv6_base_str);
    };

    switch (net)
    {
        case Network::wlan: return make_prefix_addr("fddd:7f2e:3258:");
        case Network::fleet_vpn: return make_prefix_addr("fd91:5457:1e5c:");
        case Network::vfleet_vpn: return make_prefix_addr("fd6e:cf0d:aefa:");
        case Network::cloudhub_vpn: return make_prefix_addr("fd0f:77ac:4fdf:");

        case Network::cloudhub_eth:
            // ipv6_base + 0*2^64 = no shift
            return get_base_from_arg();

        case Network::vfleet_eth:
            // ipv6_base + 1*2^64
            return ipv6_add_subnet_offset(get_base_from_arg(), 1);

        case Network::vfleet_wlan:
            // ipv6_base + 2*2^64
            return ipv6_add_subnet_offset(get_base_from_arg(), 2);

        default: throw std::invalid_argument("No IPv6 base for network: " + network_to_string(net));
    }
}

inline uint64_t ipv6_node_offset(NodeType node, int node_id)
{
    switch (node)
    {
        case NodeType::hub: return static_cast<uint64_t>(node_id);             // 0*2^16 + node_id
        case NodeType::bot: return static_cast<uint64_t>(1 * 65536 + node_id); // 1*2^16 + node_id
        case NodeType::desktop:
            return static_cast<uint64_t>(2 * 65536 + node_id); // 2*2^16 + node_id
        case NodeType::gateway: return 1;                      // node_id ignored
        case NodeType::rpicam: throw std::invalid_argument("rpicam node is not supported for ipv6");
    }
    throw std::invalid_argument("Unknown node type for IPv6");
}

} // namespace detail

// Returns IPv4 address string for a node (e.g. "10.23.1.110" for bot 10 on fleet 1 wlan)
inline std::string ipv4_addr(int fleet_id, Network net, NodeType node, int node_id)
{
    validate_fleet_id(fleet_id);
    validate_node_id(node, node_id);
    auto base = detail::ipv4_base(fleet_id, net);
    uint32_t offset = detail::ipv4_node_offset(node, node_id);
    auto result = boost::asio::ip::make_address_v4(base.to_uint() + offset);
    return result.to_string();
}

// Returns IPv4 network CIDR string (e.g. "10.23.1.0/24")
inline std::string ipv4_net(int fleet_id, Network net)
{
    validate_fleet_id(fleet_id);
    auto base = detail::ipv4_base(fleet_id, net);
    int prefix = detail::ipv4_prefix_len(net);
    return base.to_string() + "/" + std::to_string(prefix);
}

// Returns IPv6 address string for a node
// ipv6_base_str is required for cloudhub_eth, vfleet_eth, vfleet_wlan networks
inline std::string ipv6_addr(int fleet_id, Network net, NodeType node, int node_id,
                             const std::string& ipv6_base_str = "")
{
    validate_fleet_id(fleet_id);
    validate_node_id(node, node_id);
    auto base = detail::ipv6_base(fleet_id, net, ipv6_base_str);
    uint64_t offset = detail::ipv6_node_offset(node, node_id);
    auto result = detail::ipv6_add_offset(base, offset);
    return result.to_string();
}

// Returns IPv6 network CIDR string (e.g. "fddd:7f2e:3258:1::/64")
inline std::string ipv6_net(int fleet_id, Network net, const std::string& ipv6_base_str = "")
{
    validate_fleet_id(fleet_id);
    auto base = detail::ipv6_mask64(detail::ipv6_base(fleet_id, net, ipv6_base_str));
    return base.to_string() + "/64";
}

} // namespace ip
} // namespace jaiabot

#endif

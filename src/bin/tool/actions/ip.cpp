#include <iostream>

#include "goby/middleware/application/tool.h"

#include "common.h"
#include "ip.h"

#include "jaiabot/utils/ip.h"

namespace
{
jaiabot::ip::Network proto_net_to_ip_net(jaiabot::config::Net net)
{
    switch (net)
    {
        case jaiabot::config::wlan: return jaiabot::ip::Network::wlan;
        case jaiabot::config::fleet_vpn: return jaiabot::ip::Network::fleet_vpn;
        case jaiabot::config::vfleet_vpn: return jaiabot::ip::Network::vfleet_vpn;
        case jaiabot::config::cloudhub_vpn: return jaiabot::ip::Network::cloudhub_vpn;
        case jaiabot::config::cloudhub_eth: return jaiabot::ip::Network::cloudhub_eth;
        case jaiabot::config::vfleet_eth: return jaiabot::ip::Network::vfleet_eth;
        case jaiabot::config::vfleet_wlan: return jaiabot::ip::Network::vfleet_wlan;
        case jaiabot::config::vpc: return jaiabot::ip::Network::vpc;
    }
    throw std::invalid_argument("Unknown Net enum value: " + std::to_string(net));
}

jaiabot::ip::NodeType proto_node_type_to_ip_node(jaiabot::config::IPTool::NodeType node)
{
    switch (node)
    {
        case jaiabot::config::IPTool::bot: return jaiabot::ip::NodeType::bot;
        case jaiabot::config::IPTool::hub: return jaiabot::ip::NodeType::hub;
        case jaiabot::config::IPTool::desktop: return jaiabot::ip::NodeType::desktop;
        case jaiabot::config::IPTool::gateway: return jaiabot::ip::NodeType::gateway;
        case jaiabot::config::IPTool::rpicam: return jaiabot::ip::NodeType::rpicam;
    }
    throw std::invalid_argument("Unknown NodeType enum value: " + std::to_string(node));
}
} // namespace

jaiabot::apps::IPTool::IPTool()
{
    if (app_cfg().has_host())
    {
        // Host-code mode: e.g. "b4f2", "h1f3", "chf4"
        std::string host_ip = tool::parse_host_ip_from_code(app_cfg().host());
        std::cout << host_ip << std::endl;
    }
    else
    {
        // Explicit mode: --fleet_id, --ip_net, --ip_version, [--query_type], [--node_type],
        // [--node_id], [--ipv6_base]
        if (!app_cfg().has_fleet_id())
            goby::glog.is_die() && goby::glog << "--fleet_id is required in explicit mode"
                                              << std::endl;
        if (!app_cfg().has_ip_net())
            goby::glog.is_die() && goby::glog << "--ip_net is required in explicit mode"
                                              << std::endl;
        if (!app_cfg().has_ip_version())
            goby::glog.is_die() && goby::glog << "--ip_version is required in explicit mode"
                                              << std::endl;

        int fleet_id = app_cfg().fleet_id();
        auto ip_net = proto_net_to_ip_net(app_cfg().ip_net());
        bool is_ipv4 = app_cfg().ip_version() == jaiabot::config::IPTool::ipv4;
        std::string ipv6_base_str = app_cfg().has_ipv6_base() ? app_cfg().ipv6_base() : "";
        auto query_type =
            app_cfg().has_query_type() ? app_cfg().query_type() : jaiabot::config::IPTool::addr;

        try
        {
            if (query_type == jaiabot::config::IPTool::addr)
            {
                if (!app_cfg().has_node_type())
                    goby::glog.is_die() && goby::glog << "--node_type is required for addr queries"
                                                      << std::endl;

                auto node_type = proto_node_type_to_ip_node(app_cfg().node_type());

                // gateway always uses node_id=0; all other types require --node_id
                int node_id = 0;
                if (node_type != jaiabot::ip::NodeType::gateway)
                {
                    if (!app_cfg().has_node_id())
                        goby::glog.is_die() &&
                            goby::glog << "--node_id is required for addr queries (except gateway)"
                                       << std::endl;
                    node_id = app_cfg().node_id();
                }

                std::string result;
                if (is_ipv4)
                    result = jaiabot::ip::ipv4_addr(fleet_id, ip_net, node_type, node_id);
                else
                    result =
                        jaiabot::ip::ipv6_addr(fleet_id, ip_net, node_type, node_id, ipv6_base_str);
                std::cout << result << std::endl;
            }
            else // net query
            {
                std::string result;
                if (is_ipv4)
                    result = jaiabot::ip::ipv4_net(fleet_id, ip_net);
                else
                    result = jaiabot::ip::ipv6_net(fleet_id, ip_net, ipv6_base_str);
                std::cout << result << std::endl;
            }
        }
        catch (const std::exception& e)
        {
            goby::glog.is_die() && goby::glog << "IP computation failed: " << e.what() << std::endl;
        }
    }
    quit(0);
}

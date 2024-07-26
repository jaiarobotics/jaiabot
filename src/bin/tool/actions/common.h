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

#include <boost/filesystem.hpp>
#include <regex>

#include <goby/util/debug_logger.h>

#include "actions/net.pb.h"

inline std::string parse_host_ip_from_code(const std::string& host_code)
{
    if (host_code == "self")
        return "::1";

    std::regex host_pattern("([bh])([0-9]+)([svc]?)f([0-9]+)|(ch)f([0-9]+)");
    std::smatch host_matches;

    if (std::regex_match(host_code, host_matches, host_pattern))
    {
        std::string node_code = host_matches[1];
        std::string node_id = host_matches[2];
        std::string net_code = host_matches[3];
        std::string fleet_id = host_matches[4];

        jaiabot::config::Net net;
        if (net_code == "s")
            net = jaiabot::config::fleet_vpn;
        else if (net_code == "v")
            net = jaiabot::config::vfleet_vpn;
        else if (net_code == "c")
            net = jaiabot::config::cloudhub_vpn;
        else
            net = jaiabot::config::wlan;

        std::string node_type;
        if (node_code == "b")
        {
            node_type = "bot";
        }
        else if (node_code == "h")
        {
            node_type = "hub";
        }
        else if (host_matches[5] == "ch")
        {
            node_type = "hub";
            node_id = "30";
            fleet_id = host_matches[6];
            net = jaiabot::config::cloudhub_vpn;
        }

        // Constructing the command
        std::string command = "jaia-ip.py";

        // Check if jaia-ip.py is on the path
        if (std::system("which jaia-ip.py > /dev/null 2>&1"))
            goby::glog.is_die() && goby::glog << "Could not find jaia-ip.py. Ensure that it is on "
                                                 "your path"
                                              << std::endl;

        command += " addr --node " + node_type + " --fleet_id " + fleet_id + " --node_id " +
                   node_id + " --net " + jaiabot::config::Net_Name(net);

        // legacy IPv4 networks - remove once these are deprecated
        if (net == jaiabot::config::wlan || net == jaiabot::config::fleet_vpn)
            command += " --ipv4";
        else
            command += " --ipv6";

        // Running the command and reading the output
        FILE* pipe = popen(command.c_str(), "r");
        if (!pipe)
        {
            goby::glog.is_die() && goby::glog << "Failed to open pipe for jaia-ip.py execution."
                                              << std::endl;
        }

        std::stringstream ip_output;
        char buffer[128];
        while (fgets(buffer, sizeof(buffer), pipe) != NULL) { ip_output << buffer; }

        int return_code = pclose(pipe);
        if (return_code != 0)
        {
            goby::glog.is_die() && goby::glog << "jaia-ip.py command returned error. " << std::endl;
        }
        std::string host_ip = ip_output.str();
        goby::glog.is_verbose() && goby::glog << host_code << " (" << jaiabot::config::Net_Name(net)
                                              << "): " << host_ip << std::endl;

        boost::trim(host_ip);
        return host_ip;
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

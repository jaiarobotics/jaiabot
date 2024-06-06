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

inline std::string parse_host_ip_from_code(const std::string& host_code, bool has_net,
                                           jaiabot::config::Net net, bool ipv6)
{
    std::regex host_pattern("([bh])([0-9]+)f([0-9]+)|(ch)f([0-9]+)");
    std::smatch host_matches;

    if (std::regex_match(host_code, host_matches, host_pattern))
    {
        std::string node_id = host_matches[2];
        std::string fleet_id = host_matches[3];
        std::string node_type;
        if (host_matches[1] == "b")
        {
            node_type = "bot";
            node_id = host_matches[2];
            fleet_id = host_matches[3];
        }
        else if (host_matches[1] == "h")
        {
            node_type = "hub";
            node_id = host_matches[2];
            fleet_id = host_matches[3];
        }
        else if (host_matches[4] == "ch")
        {
            node_type = "hub";
            node_id = "30";
            fleet_id = host_matches[5];

            // only meaningful net for cloudhub
            if (has_net && net != jaiabot::config::cloudhub_vpn)
                std::cerr << "Setting net to cloudhub_vpn" << std::endl;

            net = jaiabot::config::cloudhub_vpn;
        }

        // Constructing the command
        std::string command = "ip.py";

        // Check if ip.py is on the path
        if (std::system("which ip.py > /dev/null 2>&1"))
        {
            // ip.py is not on the path, use the fallback path
            std::string ip_py_etc = "/etc/jaiabot/ip.py";
            if (boost::filesystem::exists(ip_py_etc))
                command = ip_py_etc;
            else
                goby::glog.is_die() && goby::glog << "Could not find ip.py. Ensure that it is on "
                                                     "your path or in /etc/jaiabot/ip.py"
                                                  << std::endl;
        }
        command += " addr --node " + node_type + " --fleet_id " + fleet_id + " --node_id " +
                   node_id + " --net " + jaiabot::config::Net_Name(net);

        if (!ipv6 && (net == jaiabot::config::wlan || net == jaiabot::config::fleet_vpn))
            command += " --ipv4";
        else
            command += " --ipv6";

        // Running the command and reading the output
        FILE* pipe = popen(command.c_str(), "r");
        if (!pipe)
        {
            goby::glog.is_die() && goby::glog << "Failed to open pipe for ip.py execution."
                                              << std::endl;
        }

        std::stringstream ip_output;
        char buffer[128];
        while (fgets(buffer, sizeof(buffer), pipe) != NULL) { ip_output << buffer; }

        int return_code = pclose(pipe);
        if (return_code != 0)
        {
            goby::glog.is_die() && goby::glog << "ip.py command returned error. " << std::endl;
        }
        std::string host_ip = ip_output.str();
        goby::glog.is_verbose() && goby::glog << host_code << " (" << jaiabot::config::Net_Name(net)
                                              << "): " << host_ip << std::endl;

        boost::trim(host_ip);
        return host_ip;
    }
    else
    {
        goby::glog.is_die() &&
            goby::glog
                << "Host string is invalid: " << host_code
                << ". It must be b<bot_id>f<fleet_id> or h<hub_id>f<fleet_id> or chf<fleet_id> "
                   "(for cloudhub)"
                << std::endl;
    }
    return "";
}

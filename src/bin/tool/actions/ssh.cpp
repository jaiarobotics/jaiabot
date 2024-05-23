#include <regex>

#include "goby/middleware/application/tool.h"

#include "ssh.h"

#include <boost/filesystem.hpp>

jaiabot::apps::SshTool::SshTool()
{
    std::vector<std::string> args{"ssh"};

    std::regex host_pattern("([bh])([0-9]+)f([0-9]+)|(ch)f([0-9]+)");
    std::smatch host_matches;

    if (std::regex_match(app_cfg().host(), host_matches, host_pattern))
    {
        std::string node_id = host_matches[2];
        std::string fleet_id = host_matches[3];
        std::string node_type;
        auto net = app_cfg().net();
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
            if (app_cfg().has_net() && app_cfg().net() != jaiabot::config::SshTool::cloudhub_vpn)
                std::cerr << "Setting net to cloudhub_vpn" << std::endl;

            net = jaiabot::config::SshTool::cloudhub_vpn;
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
                   node_id + " --net " + jaiabot::config::SshTool::Net_Name(net);

        if (!app_cfg().ipv6() &&
            (net == jaiabot::config::SshTool::wlan || net == jaiabot::config::SshTool::fleet_vpn))
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

        goby::glog.is_verbose() && goby::glog << app_cfg().host() << " ("
                                              << jaiabot::config::SshTool::Net_Name(net)
                                              << "): " << host_ip << std::endl;

        boost::trim(host_ip);
        std::string user_and_host = app_cfg().user() + "@" + host_ip;
        args.push_back(user_and_host);
    }
    else
    {
        goby::glog.is_die() &&
            goby::glog
                << "Host string is invalid: " << app_cfg().host()
                << ". It must be b<bot_id>f<fleet_id> or h<hub_id>f<fleet_id> or chf<fleet_id> "
                   "(for cloudhub)"
                << std::endl;
    }

    for (const auto& cli_extra : app_cfg().app().tool_cfg().extra_cli_param())
        args.push_back(cli_extra);
    std::vector<char*> c_args;
    for (const auto& arg : args)
    {
        goby::glog.is_verbose() && goby::glog << arg << " " << std::flush;
        c_args.push_back(const_cast<char*>(arg.c_str()));
    }
    goby::glog.is_verbose() && goby::glog << std::endl;

    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    goby::glog.is_die() && goby::glog << "ERROR executing ssh" << std::endl;
    quit(0);
}

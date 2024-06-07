#include "goby/middleware/application/tool.h"

#include "common.h"
#include "ping.h"

#include <boost/filesystem.hpp>

jaiabot::apps::PingTool::PingTool()
{
    std::vector<std::string> args{"ping"};

    std::string host_ip = parse_host_ip_from_code(app_cfg().host(), app_cfg().has_net(),
                                                  app_cfg().net(), app_cfg().ipv6());
    args.push_back(host_ip);

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
    goby::glog.is_die() && goby::glog << "ERROR executing ping" << std::endl;
    quit(0);
}

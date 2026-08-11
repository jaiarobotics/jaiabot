#include <string>
#include <vector>

#include <unistd.h>

#include "set.h"

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::debconf::SetTool::SetTool()
{
    // jaia-debconf.sh validates the value against the question's Choices and, by
    // default, reconfigures the package so the systemd units are regenerated.
    std::vector<std::string> args{"jaia-debconf.sh", "set", app_cfg().question(),
                                  app_cfg().value()};

    if (!app_cfg().reconfigure())
        args.push_back("--no-reconfigure");

    std::vector<char*> c_args;
    for (const auto& arg : args) { c_args.push_back(const_cast<char*>(arg.c_str())); }
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    glog.is_die() && glog << "ERROR executing jaia-debconf.sh" << std::endl;
    quit(0);
}

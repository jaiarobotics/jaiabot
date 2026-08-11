#include <string>
#include <vector>

#include <unistd.h>

#include "get.h"

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::debconf::GetTool::GetTool()
{
    // jaia-debconf.sh is the single reader/writer of the debconf database; this
    // action is a front end for it so that 'jaia admin' is a discoverable entry
    // point for the same operations.
    std::vector<std::string> args{"jaia-debconf.sh", "get", app_cfg().question()};

    std::vector<char*> c_args;
    for (const auto& arg : args) { c_args.push_back(const_cast<char*>(arg.c_str())); }
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    glog.is_die() && glog << "ERROR executing jaia-debconf.sh" << std::endl;
    quit(0);
}

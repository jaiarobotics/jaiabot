#include <string>
#include <vector>

#include <unistd.h>

#include "list.h"

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::debconf::ListTool::ListTool()
{
    // Reads the package's templates file rather than the debconf database, so
    // unlike get and set this does not need root.
    std::vector<std::string> args{"jaia-debconf.sh", "list"};

    if (app_cfg().all())
        args.push_back("--all");

    std::vector<char*> c_args;
    for (const auto& arg : args) { c_args.push_back(const_cast<char*>(arg.c_str())); }
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    glog.is_die() && glog << "ERROR executing jaia-debconf.sh" << std::endl;
    quit(0);
}

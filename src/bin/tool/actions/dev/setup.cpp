#include <stdexcept>
#include <string>
#include <vector>

#include <unistd.h>

#include <goby/util/debug_logger.h>

#include "setup.h"
#include "util.h"

using goby::glog;

namespace
{
constexpr const char* setup_script = "scripts/build/setup-tools-build.sh";
} // namespace

jaiabot::apps::dev::SetupTool::SetupTool()
{
    std::vector<std::string> args;

    try
    {
        args.push_back(jaiabot::apps::dev::find_in_repo(setup_script).string());
    }
    catch (const std::exception& e)
    {
        glog.is_die() && glog << e.what() << std::endl;
    }

    std::vector<char*> c_args;
    for (const auto& arg : args) c_args.push_back(const_cast<char*>(arg.c_str()));
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    glog.is_die() && glog << "ERROR executing " << args[0] << std::endl;
    quit(0);
}

#include <stdexcept>

#include <boost/filesystem.hpp>
#include <goby/util/debug_logger.h>

#include "clean.h"
#include "util.h"

using goby::glog;

namespace
{
constexpr const char* build_script = "build.sh";
} // namespace

jaiabot::apps::dev::CleanTool::CleanTool()
{
    try
    {
        auto build_dir = jaiabot::apps::dev::find_in_repo(build_script).parent_path() / "build";

        if (boost::filesystem::exists(build_dir))
        {
            glog.is_verbose() && glog << "Removing " << build_dir << std::endl;
            boost::filesystem::remove_all(build_dir);
        }
        else
        {
            glog.is_verbose() && glog << build_dir << " does not exist, nothing to clean"
                                      << std::endl;
        }
    }
    catch (const std::exception& e)
    {
        glog.is_die() && glog << e.what() << std::endl;
    }

    quit(0);
}

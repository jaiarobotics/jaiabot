#include <string>
#include <vector>

#include "command.h"
#include "list.h"

#include <goby/middleware/application/tool.h>

jaiabot::apps::admin::debconf::ListTool::ListTool()
{
    // Reads the package's templates file rather than the debconf database, so
    // unlike get and set this does not need root.
    std::vector<std::string> args{"jaia-debconf.sh", "list"};

    if (app_cfg().all())
        args.push_back("--all");

    exec_jaia_debconf(args, false /* needs_root */);
    quit(0);
}

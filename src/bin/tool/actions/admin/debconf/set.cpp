#include <string>
#include <vector>

#include "command.h"
#include "set.h"

#include <goby/middleware/application/tool.h>

jaiabot::apps::admin::debconf::SetTool::SetTool()
{
    // jaia-debconf.sh validates the value against the question's Choices and, by
    // default, reconfigures the package so the systemd units are regenerated.
    std::vector<std::string> args{"jaia-debconf.sh", "set", app_cfg().question(),
                                  app_cfg().value()};

    if (!app_cfg().reconfigure())
        args.push_back("--no-reconfigure");

    exec_jaia_debconf(args, true /* needs_root */);
    quit(0);
}

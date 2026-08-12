#include <string>
#include <vector>

#include "command.h"
#include "get.h"

#include <goby/middleware/application/tool.h>

jaiabot::apps::admin::debconf::GetTool::GetTool()
{
    std::vector<std::string> args{"jaia-debconf.sh", "get"};

    // with no question, jaia-debconf.sh reports every question's current value
    if (app_cfg().has_question())
        args.push_back(app_cfg().question());
    else if (app_cfg().all())
        args.push_back("--all");

    if (app_cfg().format() == jaiabot::config::admin::debconf::GetTool::json)
        args.push_back("--json");

    exec_jaia_debconf(args, true /* needs_root */);
    quit(0);
}

#include "goby/middleware/application/tool.h"

#include "fleet.h"

#include <boost/filesystem.hpp>

jaiabot::apps::admin::FleetTool::FleetTool()
{
    goby::middleware::ToolHelper tool_helper(
        app_cfg().app().binary(), app_cfg().app().tool_cfg(),
        jaiabot::config::admin::FleetTool::Action_descriptor());

    if (!tool_helper.perform_action(app_cfg().action()))
    {
        switch (app_cfg().action())
        {
            case jaiabot::config::admin::FleetTool::help:
                int action_for_help;
                if (!tool_helper.help(&action_for_help))
                    throw(goby::Exception("Help was expected to be handled by external tool"));
                break;

            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

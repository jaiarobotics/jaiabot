#include "goby/middleware/application/tool.h"

#include "debconf.h"
#include "debconf/get.h"
#include "debconf/list.h"
#include "debconf/set.h"

#include <boost/filesystem.hpp>

jaiabot::apps::admin::DebconfTool::DebconfTool()
{
    goby::middleware::ToolHelper tool_helper(
        app_cfg().app().binary(), app_cfg().app().tool_cfg(),
        jaiabot::config::admin::DebconfTool::Action_descriptor());

    if (!tool_helper.perform_action(app_cfg().action()))
    {
        switch (app_cfg().action())
        {
            case jaiabot::config::admin::DebconfTool::help:
                int action_for_help;
                if (!tool_helper.help(&action_for_help))
                {
                    switch (action_for_help)
                    {
                        case jaiabot::config::admin::DebconfTool::get:
                            tool_helper.help<jaiabot::apps::admin::debconf::GetTool,
                                             jaiabot::apps::admin::debconf::GetToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::admin::DebconfTool::set:
                            tool_helper.help<jaiabot::apps::admin::debconf::SetTool,
                                             jaiabot::apps::admin::debconf::SetToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::admin::DebconfTool::list:
                            tool_helper.help<jaiabot::apps::admin::debconf::ListTool,
                                             jaiabot::apps::admin::debconf::ListToolConfigurator>(
                                action_for_help);
                            break;

                        default:
                            throw(goby::Exception(
                                "Help was expected to be handled by external tool"));
                            break;
                    }
                }
                break;

            case jaiabot::config::admin::DebconfTool::get:
                tool_helper.run_subtool<jaiabot::apps::admin::debconf::GetTool,
                                        jaiabot::apps::admin::debconf::GetToolConfigurator>();
                break;

            case jaiabot::config::admin::DebconfTool::set:
                tool_helper.run_subtool<jaiabot::apps::admin::debconf::SetTool,
                                        jaiabot::apps::admin::debconf::SetToolConfigurator>();
                break;

            case jaiabot::config::admin::DebconfTool::list:
                tool_helper.run_subtool<jaiabot::apps::admin::debconf::ListTool,
                                        jaiabot::apps::admin::debconf::ListToolConfigurator>();
                break;

            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

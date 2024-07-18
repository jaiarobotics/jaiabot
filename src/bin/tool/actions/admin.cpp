#include "goby/middleware/application/tool.h"

#include "admin.h"
#include "admin/ssh.h"
#include "common.h"

#include <boost/filesystem.hpp>

jaiabot::apps::AdminTool::AdminTool()
{
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), app_cfg().app().tool_cfg(),
                                             jaiabot::config::AdminTool::Action_descriptor());

    if (!tool_helper.perform_action(app_cfg().action()))
    {
        switch (app_cfg().action())
        {
            case jaiabot::config::AdminTool::help:
                int action_for_help;
                if (!tool_helper.help(&action_for_help))
                {
                    switch (action_for_help)
                    {
                        case jaiabot::config::AdminTool::ssh:
                            tool_helper.help<jaiabot::apps::admin::SSHTool,
                                             jaiabot::apps::admin::SSHToolConfigurator>(
                                action_for_help);
                            break;

                        default:
                            throw(goby::Exception(
                                "Help was expected to be handled by external tool"));
                            break;
                    }
                }
                break;

            case jaiabot::config::AdminTool::ssh:
                tool_helper.run_subtool<jaiabot::apps::admin::SSHTool,
                                        jaiabot::apps::admin::SSHToolConfigurator>();

                break;

            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

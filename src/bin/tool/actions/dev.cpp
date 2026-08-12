#include "goby/middleware/application/tool.h"

#include "dev.h"
#include "dev/local_deploy.h"

jaiabot::apps::DevTool::DevTool()
{
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), app_cfg().app().tool_cfg(),
                                             jaiabot::config::DevTool::Action_descriptor());

    if (!tool_helper.perform_action(app_cfg().action()))
    {
        switch (app_cfg().action())
        {
            case jaiabot::config::DevTool::help:
                int action_for_help;
                if (!tool_helper.help(&action_for_help))
                {
                    switch (action_for_help)
                    {
                        case jaiabot::config::DevTool::local_deploy:
                            tool_helper.help<jaiabot::apps::dev::LocalDeployTool,
                                             jaiabot::apps::dev::LocalDeployToolConfigurator>(
                                action_for_help);
                            break;

                        default:
                            throw(goby::Exception(
                                "Help was expected to be handled by external tool"));
                            break;
                    }
                }
                break;

            case jaiabot::config::DevTool::local_deploy:
                tool_helper.run_subtool<jaiabot::apps::dev::LocalDeployTool,
                                        jaiabot::apps::dev::LocalDeployToolConfigurator>();
                break;

            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

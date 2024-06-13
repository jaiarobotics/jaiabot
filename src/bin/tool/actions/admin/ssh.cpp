#include "goby/middleware/application/tool.h"

#include "ssh.h"
#include "ssh/add.h"

#include <boost/filesystem.hpp>

jaiabot::apps::admin::SSHTool::SSHTool()
{
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), app_cfg().app().tool_cfg(),
                                             jaiabot::config::admin::SSHTool::Action_descriptor());

    if (!tool_helper.perform_action(app_cfg().action()))
    {
        switch (app_cfg().action())
        {
            case jaiabot::config::admin::SSHTool::help:
                int action_for_help;
                if (!tool_helper.help(&action_for_help))
                {
                    switch (action_for_help)
                    {
                        case jaiabot::config::admin::SSHTool::add:
                            tool_helper.help<jaiabot::apps::admin::ssh::AddTool,
                                             jaiabot::apps::admin::ssh::AddToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::admin::SSHTool::remove:
                            //                            tool_helper.help<jaiabot::apps::ssh::SSHTool,
                            //                                             jaiabot::apps::ssh::SSHToolConfigurator>(
                            //                                action_for_help);
                            break;

                        default:
                            throw(goby::Exception(
                                "Help was expected to be handled by external tool"));
                            break;
                    }
                }
                break;

            case jaiabot::config::admin::SSHTool::add:
                tool_helper.run_subtool<jaiabot::apps::admin::ssh::AddTool,
                                        jaiabot::apps::admin::ssh::AddToolConfigurator>();
                break;

            case jaiabot::config::admin::SSHTool::remove:
                //                tool_helper.run_subtool<jaiabot::apps::ssh::SSHTool,
                //                                        jaiabot::apps::ssh::SSHToolConfigurator>();

                break;

            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

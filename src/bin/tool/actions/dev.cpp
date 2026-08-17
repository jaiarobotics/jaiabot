#include "goby/middleware/application/tool.h"

#include "dev.h"
#include "dev/build.h"
#include "dev/clean.h"
#include "dev/docker.h"
#include "dev/local_deploy.h"
#include "dev/setup.h"

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

                        case jaiabot::config::DevTool::build:
                            tool_helper.help<jaiabot::apps::dev::BuildTool,
                                             jaiabot::apps::dev::BuildToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::DevTool::clean:
                            tool_helper.help<jaiabot::apps::dev::CleanTool,
                                             jaiabot::apps::dev::CleanToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::DevTool::setup:
                            tool_helper.help<jaiabot::apps::dev::SetupTool,
                                             jaiabot::apps::dev::SetupToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::DevTool::docker:
                            tool_helper.help<jaiabot::apps::dev::DockerTool,
                                             jaiabot::apps::dev::DockerToolConfigurator>(
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

            case jaiabot::config::DevTool::build:
                tool_helper.run_subtool<jaiabot::apps::dev::BuildTool,
                                        jaiabot::apps::dev::BuildToolConfigurator>();
                break;

            case jaiabot::config::DevTool::clean:
                tool_helper.run_subtool<jaiabot::apps::dev::CleanTool,
                                        jaiabot::apps::dev::CleanToolConfigurator>();
                break;

            case jaiabot::config::DevTool::setup:
                tool_helper.run_subtool<jaiabot::apps::dev::SetupTool,
                                        jaiabot::apps::dev::SetupToolConfigurator>();
                break;

            case jaiabot::config::DevTool::docker:
                tool_helper.run_subtool<jaiabot::apps::dev::DockerTool,
                                        jaiabot::apps::dev::DockerToolConfigurator>();
                break;

            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

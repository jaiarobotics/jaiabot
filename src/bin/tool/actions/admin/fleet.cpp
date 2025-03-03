#include "goby/middleware/application/tool.h"

#include "fleet.h"
#include "fleet/validate.h"
#include "fleet/vpn_authorize.h"

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
                {
                    switch (action_for_help)
                    {
                        case jaiabot::config::admin::FleetTool::validate:
                            tool_helper.help<jaiabot::apps::admin::fleet::ValidateTool,
                                             jaiabot::apps::admin::fleet::ValidateToolConfigurator>(
                                action_for_help);
                            break;

                        case jaiabot::config::admin::FleetTool::vpn_authorize:
                            tool_helper
                                .help<jaiabot::apps::admin::fleet::VPNAuthorizeTool,
                                      jaiabot::apps::admin::fleet::VPNAuthorizeToolConfigurator>(
                                    action_for_help);
                            break;

                        default:
                            throw(goby::Exception(
                                "Help was expected to be handled by external tool"));
                            break;
                    }
                }
                break;

            case jaiabot::config::admin::FleetTool::validate:
                tool_helper.run_subtool<jaiabot::apps::admin::fleet::ValidateTool,
                                        jaiabot::apps::admin::fleet::ValidateToolConfigurator>();
                break;

            case jaiabot::config::admin::FleetTool::vpn_authorize:
                tool_helper
                    .run_subtool<jaiabot::apps::admin::fleet::VPNAuthorizeTool,
                                 jaiabot::apps::admin::fleet::VPNAuthorizeToolConfigurator>();
                break;

            default:
                throw(goby::Exception("Action was expected to be handled by external tool"));
                break;
        }
    }
    quit(0);
}

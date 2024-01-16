#include "goby/middleware/application/tool.h"

#include "version.h"

jaiabot::apps::VersionTool::VersionTool()
{
    // goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), app_cfg().app().tool_cfg(),
    //                                          jaiabot::config::VersionTool::Action_descriptor());

    // if (!tool_helper.perform_action(app_cfg().action()))
    // {
    //     switch (app_cfg().action())
    //     {
    //         case jaiabot::config::VersionTool::help:
    //             int action_for_help;
    //             if (!tool_helper.help(&action_for_help))
    //             {
    //                 switch (action_for_help)
    //                 {
    //                     default:
    //                         throw(goby::Exception(
    //                             "Help was expected to be handled by external tool"));
    //                         break;
    //                 }
    //             }
    //             break;

    //         default:
    //             throw(goby::Exception("Action was expected to be handled by external tool"));
    //             break;
    //     }
    // }

    quit(0);
}

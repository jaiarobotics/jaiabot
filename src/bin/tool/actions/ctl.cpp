#include "goby/middleware/application/tool.h"

#include "ctl.h"

jaiabot::apps::CtlTool::CtlTool()
{
    std::vector<std::string> args{"systemctl"};
    args.push_back(app_cfg().action());

    for (const auto& cli_extra : app_cfg().app().tool_cfg().extra_cli_param())
        args.push_back(cli_extra);
    std::vector<char*> c_args;
    for (const auto& arg : args) { c_args.push_back(const_cast<char*>(arg.c_str())); }
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    goby::glog.is_die() && goby::glog << "ERROR executing systemctl" << std::endl;
    quit(0);
}

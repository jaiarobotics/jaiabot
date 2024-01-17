#include "goby/middleware/application/tool.h"

#include "ssh.h"

jaiabot::apps::SshTool::SshTool()
{
    std::vector<std::string> args{"ssh"};

    std::string host_ip = app_cfg().host(); // todo - translate from shortcut using ip.py
    args.push_back(host_ip);

    for (const auto& cli_extra : app_cfg().app().tool_cfg().extra_cli_param())
        args.push_back(cli_extra);
    std::vector<char*> c_args;
    for (const auto& arg : args) { c_args.push_back(const_cast<char*>(arg.c_str())); }
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    std::cerr << "ERROR executing ssh" << std::endl;
    quit(0);
}

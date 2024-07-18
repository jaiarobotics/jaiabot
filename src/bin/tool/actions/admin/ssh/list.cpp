#include "../../common.h"
#include "../../ssh.h"
#include "config.pb.h"

#include "list.h"

#include <boost/filesystem.hpp>

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>
#include <goby/util/debug_logger/term_color.h>

using goby::glog;

jaiabot::apps::admin::ssh::ListTool::ListTool()
{
    goby::middleware::protobuf::AppConfig::Tool subtool_cfg;
    subtool_cfg.add_extra_cli_param("--user=" + app_cfg().user());
    subtool_cfg.add_extra_cli_param(app_cfg().host());
    subtool_cfg.add_extra_cli_param(std::string() + "for file in $HOME/.ssh/authorized_keys " +
                                    "/etc/jaiabot/ssh/*authorized_keys; " + "do " +
                                    "echo \"#### begin " + goby::util::esc_green + " $file " +
                                    goby::util::esc_nocolor + " #### \"; " + "cat $file; " +
                                    "echo \"#### end   " + goby::util::esc_green + " $file " +
                                    goby::util::esc_nocolor + " #### \"; " + "done");
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), subtool_cfg,
                                             jaiabot::config::Tool::Action_descriptor());

    tool_helper.run_subtool<jaiabot::apps::SshTool, jaiabot::apps::SshToolConfigurator>();

    quit(0);
}

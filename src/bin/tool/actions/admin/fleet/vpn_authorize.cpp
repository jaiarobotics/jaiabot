#include <string>

#include "../../common.h"
#include "../../ssh.h"
#include "common.h"
#include "config.pb.h"
#include "vpn_authorize.h"

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::fleet::VPNAuthorizeTool::VPNAuthorizeTool()
{
    auto fleet_cfg = jaiabot::apps::tool::parse_fleet_config_from_file(app_cfg().fleet_cfg());

    if (!fleet_cfg.ssh().has_vpn_tmp())
        glog.is_die() && glog << "No vpn_tmp key defined in this fleet config" << std::endl;

    auto pubkey = fleet_cfg.ssh().vpn_tmp().public_key();

    std::string command = "sudo jaia-vpn-authorize.sh ";
    if (app_cfg().rm())
        command += "--rm ";
    command += "'" + pubkey + "'";
    if (!app_cfg().rm())
        command += " " + std::to_string(app_cfg().valid_for_days());

    // The CloudHub is only reachable over the VPN it is the server for, so this
    // renews an authorization but cannot create the first one.
    goby::middleware::protobuf::AppConfig::Tool subtool_cfg;
    subtool_cfg.add_extra_cli_param("chf" + std::to_string(fleet_cfg.fleet()));
    subtool_cfg.add_extra_cli_param(command);

    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), subtool_cfg,
                                             jaiabot::config::Tool::Action_descriptor());
    tool_helper.run_subtool<jaiabot::apps::SshTool, jaiabot::apps::SshToolConfigurator>();

    quit(0);
}

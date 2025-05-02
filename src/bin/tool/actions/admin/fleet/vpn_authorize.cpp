#include <chrono>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>

#include "../../common.h"
#include "../ssh/add.h"
#include "../ssh/rm.h"
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

    glog.is_verbose() && glog << "Authorizing key for 1 day: " << pubkey << std::endl;

    // Run 'jaia admin ssh' with command to add this key
    goby::middleware::protobuf::AppConfig::Tool subtool_cfg;

    subtool_cfg.add_extra_cli_param("vpn.jaia.tech");
    subtool_cfg.add_extra_cli_param(pubkey);

    if (!app_cfg().rm())
        subtool_cfg.add_extra_cli_param("1d");

    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), subtool_cfg,
                                             jaiabot::config::Tool::Action_descriptor());

    if (!app_cfg().rm())
        tool_helper.run_subtool<jaiabot::apps::admin::ssh::AddTool,
                                jaiabot::apps::admin::ssh::AddToolConfigurator>();
    else
        tool_helper.run_subtool<jaiabot::apps::admin::ssh::RemoveTool,
                                jaiabot::apps::admin::ssh::RemoveToolConfigurator>();

    quit(0);
}

#include "../../common.h"
#include "../../ssh.h"
#include "config.pb.h"

#include "rm.h"

#include <boost/filesystem.hpp>

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::ssh::RemoveTool::RemoveTool()
{
    std::vector<PubKeyManager::PubKey> keys_to_remove;

    if (app_cfg().has_pubkey())
    {
        bool pubkey_found;
        PubKeyManager::PubKey pubkey;

        std::tie(pubkey_found, pubkey) = pk_manager_.find(app_cfg().pubkey());
        if (!pubkey_found)
        {
            glog.is_die() && glog << "pubkey must be a full public key or ID (comment) "
                                     "corresponding to a public key compiled into this tool."
                                  << std::endl;
        }
        keys_to_remove.push_back(pubkey);
    }

    if (app_cfg().revoked())
    {
        for (const auto& p : pk_manager_.revoked_pubkeys()) { keys_to_remove.push_back(p.second); }
    }

    if (keys_to_remove.empty())
        glog.is_die() && glog << "No keys to remove! Must specify --pubkey= or --revoked"
                              << std::endl;

    glog.is_verbose() && glog << "Removing authorized_keys entries: " << std::endl;

    std::string sed_pattern;
    for (const auto& pk : keys_to_remove)
    {
        glog.is_verbose() && glog << pk.to_str() << std::endl;
        sed_pattern += "\\," + pk.b64_key + ",d;";
    }
    sed_pattern.pop_back();

    glog.is_debug1() && glog << "Sed pattern: " << sed_pattern << std::endl;

    // Run 'jaia ssh' with command to remove key from tmp_authorized_keys
    goby::middleware::protobuf::AppConfig::Tool subtool_cfg;
    subtool_cfg.add_extra_cli_param("--user=" + app_cfg().user());
    subtool_cfg.add_extra_cli_param(app_cfg().host());
    subtool_cfg.add_extra_cli_param("sudo sed -i '" + sed_pattern + "' " +
                                    app_cfg().authorized_keys_file());
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), subtool_cfg,
                                             jaiabot::config::Tool::Action_descriptor());

    tool_helper.run_subtool<jaiabot::apps::SshTool, jaiabot::apps::SshToolConfigurator>();

    quit(0);
}

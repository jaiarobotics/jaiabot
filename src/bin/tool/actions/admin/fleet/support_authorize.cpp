#include <string>

#include "../../common.h"
#include "../../ssh.h"
#include "../ssh/pubkeys.h"
#include "config.pb.h"
#include "support_authorize.h"
#include "support_keys.h"

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::fleet::SupportAuthorizeTool::SupportAuthorizeTool()
{
    const auto& keys = support_keys();
    auto key = keys.find(app_cfg().support_key());
    if (key == keys.end())
    {
        std::string known;
        for (const auto& k : keys) known += " " + k.first;
        glog.is_die() && glog << "No support desktop '" << app_cfg().support_key()
                              << "' is compiled into this tool. Known:" << known << std::endl;
    }

    std::string command = "sudo jaia-support-access.py ";
    if (app_cfg().rm())
    {
        command += "revoke --desktop " + std::to_string(key->second.desktop_id);
    }
    else
    {
        if (!app_cfg().has_pubkey())
            glog.is_die() && glog << "A pubkey is required to make a grant" << std::endl;

        jaiabot::apps::admin::ssh::PubKeyManager pk_manager;
        bool pubkey_found;
        jaiabot::apps::admin::ssh::PubKeyManager::PubKey pubkey;
        std::tie(pubkey_found, pubkey) = pk_manager.find(app_cfg().pubkey());
        if (!pubkey_found)
            glog.is_die() && glog << "pubkey must be a full public key or the ID (comment) of one "
                                     "compiled into this tool."
                                  << std::endl;

        // Options are left off: they restrict a login on one host, and this key
        // is written to every bot and hub by a script that adds its own expiry.
        command += "grant --desktop " + std::to_string(key->second.desktop_id) + " --wg-key '" +
                   key->second.wg_pubkey + "' --ssh-key '" + pubkey.keytype + " " + pubkey.b64_key +
                   " " + pubkey.comment + "' --days " + std::to_string(app_cfg().valid_for_days());
    }

    // Run on the CloudHub, which is reached with the shell the customer's own
    // grant provides: a tier 3 grant can only be made by someone who already
    // holds tier 2.
    goby::middleware::protobuf::AppConfig::Tool subtool_cfg;
    subtool_cfg.add_extra_cli_param("chf" + std::to_string(app_cfg().fleet()));
    subtool_cfg.add_extra_cli_param(command);

    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), subtool_cfg,
                                             jaiabot::config::Tool::Action_descriptor());
    tool_helper.run_subtool<jaiabot::apps::SshTool, jaiabot::apps::SshToolConfigurator>();

    quit(0);
}

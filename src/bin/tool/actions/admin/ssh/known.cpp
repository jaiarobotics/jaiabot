#include "../../common.h"
#include "../../ssh.h"
#include "config.pb.h"

#include "known.h"

#include <boost/filesystem.hpp>

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>
#include <goby/util/debug_logger/term_color.h>

using goby::glog;

jaiabot::apps::admin::ssh::KnownTool::KnownTool()
{
    if (app_cfg().revoked())
    {
        std::cout << "Known REVOKED keys: " << std::endl;
        display_keys(pk_manager_.revoked_pubkeys());
    }
    else
    {
        std::cout << "Known VALID keys: " << std::endl;
        display_keys(pk_manager_.pubkeys());
    }
    quit(0);
}

void jaiabot::apps::admin::ssh::KnownTool::display_keys(
    const std::map<std::string, PubKeyManager::PubKey>& keys)
{
    for (const auto& p : keys)
    {
        if (app_cfg().full())
            std::cout << "\t" << p.second.to_str() << std::endl;
        else
            std::cout << "\t" << p.first << std::endl;
    }
}

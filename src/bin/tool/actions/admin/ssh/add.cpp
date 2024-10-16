#include <chrono>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>

#include "../../common.h"
#include "../../ssh.h"
#include "config.pb.h"

#include "add.h"

#include <boost/filesystem.hpp>

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

std::tm add_days(const std::tm& src, int days)
{
    std::tm temp = src;
    std::time_t time_temp = std::mktime(&temp) + days * 86400; // 86400 seconds in a day
    return *std::localtime(&time_temp);
}
std::tm add_months(const std::tm& src, int months)
{
    std::tm temp = src;
    temp.tm_mon += months;
    // Normalize the time structure
    std::time_t time_temp = std::mktime(&temp);
    return *std::localtime(&time_temp);
}

// Function to process the input duration and return the formatted expiry time string
std::string calculate_expiry_time(const std::string& duration)
{
    // Get the current time
    std::time_t t = std::time(nullptr);
    std::tm tm = *std::localtime(&t);

    // Determine the type and value of the duration
    char type = duration.back();
    int value = std::stoi(duration.substr(0, duration.size() - 1));

    // Calculate the new time based on the type
    if (type == 'd')
    {
        tm = add_days(tm, value);
    }
    else if (type == 'w')
    {
        tm = add_days(tm, value * 7);
    }
    else if (type == 'm')
    {
        tm = add_months(tm, value);
    }
    else
    {
        goby::glog.is_die() &&
            goby::glog << "valid_for string (" << duration
                       << ") is invalid: must be Nd for N days, Nw for N weeks, or Nm for N months"
                       << std::endl;
    }

    // Format the new time as "YYYYMMDD"
    std::ostringstream oss;
    oss << "expiry-time=\"" << std::put_time(&tm, "%Y%m%d") << "\"";
    return oss.str();
}

jaiabot::apps::admin::ssh::AddTool::AddTool()
{
    std::string authorized_keys_file = app_cfg().authorized_keys_file();
    std::string expiry_time;
    if (app_cfg().valid_for() == "forever")
    {
        // default permanent keys to /home/jaia/.ssh/authorized_keys
        if (!app_cfg().has_authorized_keys_file())
            authorized_keys_file = tool::perm_authorized_keys_file;
    }
    else
    {
        expiry_time = calculate_expiry_time(app_cfg().valid_for());
    }

    bool pubkey_found;
    PubKeyManager::PubKey pubkey;

    std::tie(pubkey_found, pubkey) = pk_manager_.find(app_cfg().pubkey());
    if (!pubkey_found)
    {
        glog.is_die() && glog << "pubkey must be a full public key or ID (comment) "
                                 "corresponding to a public key compiled into this tool."
                              << std::endl;
    }
    if (!pubkey.options.empty())
        pubkey.options += ",";

    if (!expiry_time.empty())
        pubkey.options += expiry_time;

    glog.is_verbose() && glog << "Adding authorized_keys entry: \n" << pubkey.to_str() << std::endl;

    // Run 'jaia ssh' with command to remove old key (if exists) and append new to tmp_authorized_keys
    goby::middleware::protobuf::AppConfig::Tool subtool_cfg;
    subtool_cfg.add_extra_cli_param("--user=" + app_cfg().user());
    subtool_cfg.add_extra_cli_param(app_cfg().host());
    subtool_cfg.add_extra_cli_param("sudo sed -i '\\|" + pubkey.b64_key + "|d' " +
                                    authorized_keys_file + "; " + "echo '" + pubkey.to_str() +
                                    "' | sudo tee -a " + authorized_keys_file + "> /dev/null");
    goby::middleware::ToolHelper tool_helper(app_cfg().app().binary(), subtool_cfg,
                                             jaiabot::config::Tool::Action_descriptor());

    tool_helper.run_subtool<jaiabot::apps::SshTool, jaiabot::apps::SshToolConfigurator>();

    quit(0);
}

#include <chrono>
#include <ctime>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>

#include "../../common.h"
#include "common.h"
#include "config.pb.h"
#include "validate.h"

#include <boost/filesystem.hpp>
#include <google/protobuf/text_format.h>

#include <goby/middleware/application/tool.h>
#include <goby/util/debug_logger.h>

using goby::glog;

jaiabot::apps::admin::fleet::ValidateTool::ValidateTool()
{
    int exit_code = validate();
    quit(exit_code);
}

int jaiabot::apps::admin::fleet::ValidateTool::validate()
{
    auto fleet_cfg = jaiabot::apps::tool::parse_fleet_config_from_file(app_cfg().fleet_cfg());

    // Check if the message is fully initialized
    if (!fleet_cfg.IsInitialized())
    {
        glog.is_die() && glog << "Protobuf fleet_cfg is not fully initialized." << std::endl;
        return 1;
    }

    glog.is_verbose() && glog << "Protobuf is valid" << std::endl;
    glog.is_debug1() && glog << fleet_cfg.DebugString() << std::endl;

    return 0;
}

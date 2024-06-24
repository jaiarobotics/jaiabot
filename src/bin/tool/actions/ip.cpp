#include "goby/middleware/application/tool.h"

#include "common.h"
#include "ip.h"

#include <boost/filesystem.hpp>

jaiabot::apps::IPTool::IPTool()
{
    std::string host_ip = parse_host_ip_from_code(app_cfg().host(), app_cfg().has_net(),
                                                  app_cfg().net(), app_cfg().ipv6());
    std::cout << host_ip << std::endl;
    quit(0);
}

#include <cstdlib>
#include <stdexcept>
#include <string>
#include <vector>

#include <unistd.h>

#include <boost/filesystem.hpp>
#include <goby/util/debug_logger.h>

#include "jaiabot/utils/ip.h"
#include "local_deploy.h"

using goby::glog;

namespace
{
constexpr const char* deploy_script = "scripts/build/container-build-and-deploy.sh";
constexpr const char* range_separator = "..";

boost::filesystem::path find_deploy_script()
{
    for (auto dir = boost::filesystem::current_path(); !dir.empty(); dir = dir.parent_path())
    {
        auto script = dir / deploy_script;
        if (boost::filesystem::exists(script))
            return script;
    }

    throw std::runtime_error(std::string("Could not find ") + deploy_script +
                             " in the current directory or any of its parents: 'local_deploy' "
                             "deploys the jaiabot source tree it is run from");
}

// Expands a single target into the hosts it refers to: either one host code (e.g. "b1f6") or an
// inclusive range of them (e.g. "b1f6..b3f6")
std::vector<jaiabot::ip::HostCode> expand_target(const std::string& target, int fleet_id)
{
    auto separator = target.find(range_separator);
    if (separator == std::string::npos)
        return {jaiabot::ip::parse_host_code(target, fleet_id)};

    auto first = jaiabot::ip::parse_host_code(target.substr(0, separator), fleet_id);
    auto last = jaiabot::ip::parse_host_code(
        target.substr(separator + std::string(range_separator).size()), fleet_id);

    if (first.is_literal || last.is_literal || first.node_type != last.node_type ||
        first.fleet_id != last.fleet_id || first.net != last.net)
        throw std::invalid_argument("Both ends of the range '" + target +
                                    "' must be the same node type, fleet and network");

    if (last.node_id < first.node_id)
        throw std::invalid_argument("Range '" + target + "' must be in ascending order");

    std::vector<jaiabot::ip::HostCode> hosts;
    for (int node_id = first.node_id; node_id <= last.node_id; ++node_id)
    {
        hosts.push_back(first);
        hosts.back().node_id = node_id;
    }
    return hosts;
}

} // namespace

jaiabot::apps::dev::LocalDeployTool::LocalDeployTool()
{
    using Config = jaiabot::config::dev::LocalDeployTool;

    std::vector<std::string> args;

    try
    {
        if (app_cfg().target().empty())
            throw std::invalid_argument(
                "At least one target is required, e.g. \"jaia dev local_deploy b1f6..b3f6 h1f6\"");

        args.push_back(find_deploy_script().string());

        int fleet_id = -1;
        if (app_cfg().has_fleet())
        {
            jaiabot::ip::validate_fleet_id(app_cfg().fleet());
            fleet_id = app_cfg().fleet();
        }

        for (const auto& target : app_cfg().target())
        {
            for (const auto& host : expand_target(target, fleet_id))
            {
                std::string addr = jaiabot::ip::host_code_addr(host);
                glog.is_verbose() && glog << jaiabot::ip::node_type_to_string(host.node_type)
                                          << host.node_id << " fleet " << host.fleet_id << " ("
                                          << jaiabot::ip::network_to_string(host.net)
                                          << "): " << addr << std::endl;
                args.push_back(addr);
            }
        }
    }
    catch (const std::exception& e)
    {
        glog.is_die() && glog << e.what() << std::endl;
    }

    setenv("jaiabot_repo", Config::Repo_Name(app_cfg().repo()).c_str(), true);
    setenv("jaiabot_machine_type", Config::MachineType_Name(app_cfg().machine_type()).c_str(),
           true);
    setenv("jaiabot_rebuild_image", app_cfg().rebuild_image() ? "true" : "false", true);

    std::vector<char*> c_args;
    for (const auto& arg : args) c_args.push_back(const_cast<char*>(arg.c_str()));
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    glog.is_die() && glog << "ERROR executing " << args[0] << std::endl;
    quit(0);
}

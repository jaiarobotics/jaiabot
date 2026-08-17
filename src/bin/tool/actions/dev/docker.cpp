#include <set>
#include <string>
#include <utility>
#include <vector>

#include <unistd.h>

#include <goby/util/debug_logger.h>

#include "docker.h"

using goby::glog;

namespace
{
// Every image and container this repository creates (see container-image-build.sh,
// container-build-and-deploy.sh and scripts/sim-docker) is tagged with this Docker label
constexpr const char* jaia_label_filter = "label=jaiabot_build=true";

// 'docker' subcommands (or "<command> <subcommand>" pairs) that accept "--filter" and are worth
// scoping to just this repository's images/containers
bool accepts_jaia_filter(const std::vector<std::string>& docker_args)
{
    if (docker_args.empty())
        return false;

    static const std::set<std::string> single_word_commands = {"ps", "images"};
    static const std::set<std::pair<std::string, std::string>> two_word_commands = {
        {"image", "ls"},       {"image", "list"},      {"image", "prune"}, {"container", "ls"},
        {"container", "list"}, {"container", "prune"}, {"network", "ls"},  {"network", "list"},
        {"network", "prune"},  {"volume", "ls"},       {"volume", "list"}, {"volume", "prune"},
        {"system", "prune"},
    };

    if (single_word_commands.count(docker_args[0]))
        return true;

    return docker_args.size() > 1 && two_word_commands.count({docker_args[0], docker_args[1]});
}

} // namespace

jaiabot::apps::dev::DockerTool::DockerTool()
{
    std::vector<std::string> docker_args{app_cfg().command()};
    for (const auto& cli_extra : app_cfg().app().tool_cfg().extra_cli_param())
        docker_args.push_back(cli_extra);

    if (accepts_jaia_filter(docker_args))
        docker_args.push_back(std::string("--filter=") + jaia_label_filter);

    std::vector<std::string> args{"docker"};
    for (const auto& arg : docker_args) args.push_back(arg);

    std::vector<char*> c_args;
    for (const auto& arg : args) c_args.push_back(const_cast<char*>(arg.c_str()));
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    glog.is_die() && glog << "ERROR executing docker" << std::endl;
    quit(0);
}

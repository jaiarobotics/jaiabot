#include <cstdlib>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <vector>

#include <unistd.h>

#include <goby/util/debug_logger.h>

#include "build.h"
#include "util.h"

using goby::glog;

namespace
{
constexpr const char* build_script = "build.sh";

bool command_exists(const std::string& command)
{
    return std::system(("command -v " + command + " > /dev/null 2>&1").c_str()) == 0;
}

bool nvm_is_installed()
{
    if (const char* xdg_config_home = std::getenv("XDG_CONFIG_HOME"))
    {
        if (std::filesystem::exists(std::filesystem::path(xdg_config_home) / "nvm"))
            return true;
    }

    if (const char* home = std::getenv("HOME"))
    {
        if (std::filesystem::exists(std::filesystem::path(home) / ".nvm"))
            return true;
    }

    return false;
}

// Checks for the tools that "jaia dev setup" installs, so a missing setup step produces a clear
// error instead of a confusing failure partway through build.sh
void check_setup_has_run()
{
    std::vector<std::string> missing;
    if (!command_exists("cmake"))
        missing.push_back("cmake");
    if (!command_exists("arduino-cli"))
        missing.push_back("arduino-cli");
    if (!nvm_is_installed())
        missing.push_back("nvm (Node Version Manager)");

    if (!missing.empty())
    {
        std::string tools;
        for (size_t i = 0; i < missing.size(); ++i) tools += (i == 0 ? "" : ", ") + missing[i];

        throw std::runtime_error(
            "Missing build tool(s): " + tools +
            ". It looks like 'jaia dev setup' has not been (successfully) run on this machine. "
            "Run 'jaia dev setup' to install the required build dependencies, then try again.");
    }
}

// Appends flag=value pairs (as "<prefix><var>") from `vars` to the given environment variable,
// preserving any value the variable already has, and sets the result in the environment.
void append_to_env(const char* env_var, const std::string& prefix,
                   const google::protobuf::RepeatedPtrField<std::string>& vars)
{
    if (vars.empty())
        return;

    std::string value;
    if (const char* existing = std::getenv(env_var))
        value = std::string(existing) + " ";

    for (const auto& var : vars) value += prefix + var + " ";

    setenv(env_var, value.c_str(), true);
}

} // namespace

jaiabot::apps::dev::BuildTool::BuildTool()
{
    std::vector<std::string> args;

    try
    {
        check_setup_has_run();

        args.push_back(jaiabot::apps::dev::find_in_repo(build_script).string());

        append_to_env("JAIABOT_CMAKE_FLAGS", "-D", app_cfg().cmake_var());
        append_to_env("JAIABOT_MAKE_FLAGS", "", app_cfg().make_var());

        for (const auto& target : app_cfg().target()) args.push_back(target);
    }
    catch (const std::exception& e)
    {
        glog.is_die() && glog << e.what() << std::endl;
    }

    std::vector<char*> c_args;
    for (const auto& arg : args) c_args.push_back(const_cast<char*>(arg.c_str()));
    c_args.push_back(nullptr); // execvp expects a null-terminated array

    execvp(c_args[0], c_args.data());
    // If execvp returns, there was an error
    glog.is_die() && glog << "ERROR executing " << args[0] << std::endl;
    quit(0);
}

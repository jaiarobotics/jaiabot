#include <array>
#include <cctype>
#include <cstdio>
#include <filesystem>
#include <stdexcept>
#include <string>
#include <vector>

#include <sys/wait.h>
#include <unistd.h>

#include <goby/util/debug_logger.h>

#include "clean.h"
#include "util.h"

using goby::glog;

namespace
{
constexpr const char* build_script = "build.sh";

// e.g. "amd64", "arm64": matches the directory build.sh itself creates and builds into
std::string local_arch()
{
    std::array<char, 256> line{};
    FILE* pipe = popen("dpkg --print-architecture", "r");
    if (!pipe || !fgets(line.data(), line.size(), pipe))
        throw std::runtime_error("Could not determine this machine's architecture (dpkg "
                                 "--print-architecture failed)");
    pclose(pipe);

    std::string arch(line.data());
    while (!arch.empty() && std::isspace(static_cast<unsigned char>(arch.back()))) arch.pop_back();
    return arch;
}

void remove_as_root(const std::vector<std::filesystem::path>& dirs)
{
    if (dirs.empty())
        return;

    std::vector<std::string> args{"sudo", "rm", "-rf"};
    for (const auto& dir : dirs) args.push_back(dir.string());

    pid_t pid = fork();
    if (pid < 0)
        throw std::runtime_error("Could not fork to run sudo rm");

    if (pid == 0)
    {
        std::vector<char*> c_args;
        for (const auto& arg : args) c_args.push_back(const_cast<char*>(arg.c_str()));
        c_args.push_back(nullptr);
        execvp(c_args[0], c_args.data());
        _exit(127); // only reached if execvp failed
    }

    int status = 0;
    waitpid(pid, &status, 0);
    if (!WIFEXITED(status) || WEXITSTATUS(status) != 0)
        throw std::runtime_error("sudo rm -rf failed removing the docker build directories");
}

} // namespace

jaiabot::apps::dev::CleanTool::CleanTool()
{
    try
    {
        auto build_root = jaiabot::apps::dev::find_in_repo(build_script).parent_path() / "build";
        auto local_build_dir = build_root / local_arch();

        if (std::filesystem::exists(local_build_dir))
        {
            glog.is_verbose() && glog << "Removing " << local_build_dir << std::endl;
            std::filesystem::remove_all(local_build_dir);
        }
        else
        {
            glog.is_verbose() && glog << local_build_dir << " does not exist, nothing to clean"
                                      << std::endl;
        }

        if (app_cfg().docker() && std::filesystem::exists(build_root))
        {
            std::vector<std::filesystem::path> docker_dirs;
            for (const auto& entry : std::filesystem::directory_iterator(build_root))
            {
                if (entry.path() != local_build_dir)
                    docker_dirs.push_back(entry.path());
            }

            for (const auto& dir : docker_dirs)
                glog.is_verbose() && glog << "Removing " << dir << " (as root)" << std::endl;
            remove_as_root(docker_dirs);
        }
    }
    catch (const std::exception& e)
    {
        glog.is_die() && glog << e.what() << std::endl;
    }

    quit(0);
}

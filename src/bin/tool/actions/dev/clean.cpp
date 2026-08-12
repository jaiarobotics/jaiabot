#include <array>
#include <cctype>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <set>
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

// Paths of every file this process currently has mapped -- its own executable plus any shared
// libraries it has loaded (e.g. libjaiabot_messages.so.1 out of build/<arch>/lib) -- read from
// /proc/self/maps, so clean can avoid deleting any of them out from under itself. Empty if this
// can't be determined (e.g. not running on Linux).
std::set<std::filesystem::path> protected_paths()
{
    std::set<std::filesystem::path> paths;

    std::error_code ec;
    auto exe = std::filesystem::canonical("/proc/self/exe", ec);
    if (!ec)
        paths.insert(exe);

    std::ifstream maps("/proc/self/maps");
    std::string line;
    while (std::getline(maps, line))
    {
        auto slash = line.find('/');
        if (slash == std::string::npos)
            continue;

        auto path = std::filesystem::canonical(line.substr(slash), ec);
        if (!ec)
            paths.insert(path);
    }

    return paths;
}

// Recursively removes everything under `dir` except any path in `protect`, and the chain of
// directories needed to reach it (which are left in place, otherwise empty). Returns the
// protected paths found (and so preserved) under `dir`.
std::vector<std::filesystem::path> remove_all_except(const std::filesystem::path& dir,
                                                     const std::set<std::filesystem::path>& protect)
{
    std::vector<std::filesystem::path> found;

    for (const auto& entry : std::filesystem::directory_iterator(dir))
    {
        const auto& path = entry.path();

        // A symlink (e.g. the libfoo.so.1 SONAME symlink dynamic loading actually looks up)
        // pointing at a protected file must be kept too, not just the file it resolves to
        bool is_protected = protect.count(path) != 0;
        if (!is_protected && entry.is_symlink())
        {
            std::error_code ec;
            auto target = std::filesystem::canonical(path, ec);
            is_protected = !ec && protect.count(target) != 0;
        }

        if (is_protected)
        {
            found.push_back(path);
        }
        else if (entry.is_directory() && !entry.is_symlink())
        {
            auto nested = remove_all_except(path, protect);
            if (!nested.empty())
                found.insert(found.end(), nested.begin(), nested.end());
            else
                std::filesystem::remove_all(path);
        }
        else
        {
            std::filesystem::remove(path);
        }
    }

    return found;
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

            auto protect = protected_paths();
            auto skipped = protect.empty() ? std::vector<std::filesystem::path>{}
                                           : remove_all_except(local_build_dir, protect);

            if (!skipped.empty())
            {
                std::string list;
                for (size_t i = 0; i < skipped.size(); ++i)
                    list += (i == 0 ? "" : ", ") + skipped[i].string();

                glog.is_warn() &&
                    glog << "Skipped removing " << list
                         << ": still in use by the currently running 'jaia' tool. Rebuild (e.g. "
                            "\"jaia dev build jaia\") to replace them, or remove them manually "
                            "once you're done using it."
                         << std::endl;
            }
            else
            {
                if (protect.empty())
                    std::filesystem::remove_all(local_build_dir);
                else
                    std::filesystem::remove(local_build_dir);
            }
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

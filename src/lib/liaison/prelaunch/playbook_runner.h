#ifndef JAIABOT_LIAISON_PRELAUNCH_PLAYBOOK_RUNNER_H
#define JAIABOT_LIAISON_PRELAUNCH_PLAYBOOK_RUNNER_H

#include <chrono>
#include <cstdint>
#include <fstream>
#include <functional>
#include <future>
#include <map>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include <boost/asio/io_context.hpp>
#include <boost/process.hpp>
#if __has_include(<boost/process/v1.hpp>)
#include <boost/process/v1.hpp>
#endif

#include "config.pb.h"

namespace jaiabot
{
// Runs the JCU's playbooks for every browser session of this process, so that a run,
// its log and its result outlive the page that started it.
class PlaybookRunner
{
  public:
    struct Finished
    {
        std::uint64_t run_id{0};
        std::string json;         // ansible's result file
        std::string download_log; // the result with stdout and stderr, for "Download Log"
    };

    struct State
    {
        // of the current run, or else the last one; 0 before the first
        std::uint64_t run_id{0};
        bool running{false};
        // index into UpgradeConfig::ansible_playbook
        int playbook{-1};
        std::map<std::string, std::string> input_vars;
        std::chrono::system_clock::time_point started;
        std::vector<std::string> lines;
        // by playbook index, cleared when a run starts
        std::map<int, Finished> finished;
    };

    // The first caller's configuration is used for the life of the process
    static PlaybookRunner& instance(const protobuf::UpgradeConfig& cfg);

    // Returns false, and why in error, if a playbook is already running or will not start
    bool start(int playbook, const std::map<std::string, std::string>& input_vars,
               std::string& error);

    // f(const State&) runs with the state locked, so it should only copy what it needs
    template <typename F> void read(F f)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        f(state_);
    }

    // notify is called from the runner's own thread whenever the state changes
    int subscribe(std::function<void()> notify);
    void unsubscribe(int id);

  private:
    explicit PlaybookRunner(const protobuf::UpgradeConfig& cfg);
    PlaybookRunner(const PlaybookRunner&) = delete;
    PlaybookRunner& operator=(const PlaybookRunner&) = delete;

    struct Process
    {
        Process(const protobuf::UpgradeConfig& cfg,
                const protobuf::UpgradeConfig::AnsiblePlaybook& playbook,
                const std::string& input_vars, const std::string& stdout_file,
                const std::string& json_file);
        ~Process();

        boost::asio::io_context io;
        std::future<std::string> stderr;
#if __has_include(<boost/process/v1.hpp>)
        boost::process::v1::child child;
#else
        boost::process::child child;
#endif
        std::thread io_thread;
        std::ifstream stdout;
        std::string json_file;
        std::string partial_line;
    };

    void loop();
    // with mutex_ held; return whether anything changed
    bool read_stdout();
    void finish();
    void notify_all();

    const protobuf::UpgradeConfig cfg_;
    std::mutex mutex_;
    State state_;
    std::unique_ptr<Process> process_;

    std::mutex subscribers_mutex_;
    int next_subscriber_{0};
    std::map<int, std::function<void()>> subscribers_;

    std::thread thread_;
};

} // namespace jaiabot

#endif

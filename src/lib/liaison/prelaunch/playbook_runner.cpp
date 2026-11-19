#include <boost/filesystem.hpp>

#include <goby/util/debug_logger.h>
#include <goby/util/thirdparty/nlohmann/json.hpp>

#include "playbook_runner.h"

#if __has_include(<boost/process/v1.hpp>)
namespace bp = boost::process::v1;
#else
namespace bp = boost::process;
#endif

using goby::glog;
using namespace std::chrono_literals;

jaiabot::PlaybookRunner& jaiabot::PlaybookRunner::instance(const protobuf::UpgradeConfig& cfg)
{
    // Never destroyed: at exit its destructor would wait for a running ansible-playbook
    static PlaybookRunner* runner = new PlaybookRunner(cfg);
    return *runner;
}

jaiabot::PlaybookRunner::PlaybookRunner(const protobuf::UpgradeConfig& cfg)
    : cfg_(cfg), thread_([this]() { loop(); })
{
}

bool jaiabot::PlaybookRunner::start(int playbook,
                                    const std::map<std::string, std::string>& input_vars,
                                    std::string& error)
{
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (process_)
        {
            error = "Another playbook is already running";
            return false;
        }

        const auto& pb_playbook = cfg_.ansible_playbook(playbook);
        boost::filesystem::path playbook_path(pb_playbook.file());
        const std::string stem = cfg_.ansible_log_dir() + "/" + playbook_path.stem().native();
        const std::string stdout_file = stem + "_stdout.txt";
        const std::string json_file = stem + "_result.json";

        std::string input_vars_arg;
        for (const auto& p : input_vars) input_vars_arg += p.first + "=" + p.second + " ";

        try
        {
            // boost::process will not overwrite this file unless it is removed first
            boost::filesystem::remove(stdout_file);
            process_ = std::make_unique<Process>(cfg_, pb_playbook, input_vars_arg, stdout_file,
                                                 json_file);
        }
        catch (const std::exception& e)
        {
            glog.is_warn() && glog << "Failed to run ansible-playbook: " << e.what() << std::endl;
            error = std::string("Failed to run ansible-playbook: ") + e.what();
            process_.reset();
            return false;
        }

        glog.is_debug1() && glog << "Running playbook: " << pb_playbook.file() << std::endl;
        ++state_.run_id;
        state_.running = true;
        state_.playbook = playbook;
        state_.input_vars = input_vars;
        state_.started = std::chrono::system_clock::now();
        state_.lines.clear();
        state_.finished.clear();
    }
    notify_all();
    return true;
}

int jaiabot::PlaybookRunner::subscribe(std::function<void()> notify)
{
    std::lock_guard<std::mutex> lock(subscribers_mutex_);
    int id = next_subscriber_++;
    subscribers_[id] = std::move(notify);
    return id;
}

void jaiabot::PlaybookRunner::unsubscribe(int id)
{
    std::lock_guard<std::mutex> lock(subscribers_mutex_);
    subscribers_.erase(id);
}

void jaiabot::PlaybookRunner::notify_all()
{
    std::vector<std::function<void()>> notify;
    {
        std::lock_guard<std::mutex> lock(subscribers_mutex_);
        for (const auto& s : subscribers_) notify.push_back(s.second);
    }
    for (const auto& n : notify) n();
}

void jaiabot::PlaybookRunner::loop()
{
    while (true)
    {
        std::this_thread::sleep_for(200ms);
        bool changed = false;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (!process_)
                continue;
            changed = read_stdout();
            if (!process_->child.running())
            {
                finish();
                changed = true;
            }
        }
        if (changed)
            notify_all();
    }
}

bool jaiabot::PlaybookRunner::read_stdout()
{
    auto& p = *process_;
    char buffer[4096];
    bool read_any = false;
    while (p.stdout.read(buffer, sizeof(buffer)) || p.stdout.gcount() > 0)
    {
        p.partial_line.append(buffer, p.stdout.gcount());
        read_any = true;
    }
    // reading to the end of a file still being written sets eof; clear it to read on later
    p.stdout.clear();

    std::string::size_type newline;
    bool added = false;
    while ((newline = p.partial_line.find('\n')) != std::string::npos)
    {
        state_.lines.push_back(p.partial_line.substr(0, newline));
        p.partial_line.erase(0, newline + 1);
        added = true;
    }
    return read_any && added;
}

void jaiabot::PlaybookRunner::finish()
{
    auto& p = *process_;
    read_stdout();
    if (!p.partial_line.empty())
        state_.lines.push_back(p.partial_line);

    Finished finished;
    finished.run_id = state_.run_id;
    {
        std::ifstream json_log(p.json_file);
        std::string line;
        while (std::getline(json_log, line)) finished.json += line + "\n";
    }

    nlohmann::json stdout_stderr;
    stdout_stderr["__stderr"] = p.stderr.get();
    stdout_stderr["__stdout"] = state_.lines;
    try
    {
        auto j = nlohmann::json::parse(finished.json);
        j.update(stdout_stderr);
        finished.download_log = j.dump(2);
    }
    catch (const std::exception& e)
    {
        glog.is_warn() && glog << "Failed to parse output: " << e.what() << std::endl;
        finished.download_log = finished.json + "\n" + stdout_stderr.dump(2);
    }

    state_.finished[state_.playbook] = std::move(finished);
    state_.running = false;
    process_.reset();
}

jaiabot::PlaybookRunner::Process::Process(const protobuf::UpgradeConfig& cfg,
                                          const protobuf::UpgradeConfig::AnsiblePlaybook& playbook,
                                          const std::string& input_vars,
                                          const std::string& stdout_file,
                                          const std::string& json_file)
    : child(cfg.has_ansible_playbook_full_path()
                ? boost::filesystem::path(cfg.ansible_playbook_full_path())
                : bp::search_path("ansible-playbook"),
            "-i", playbook.has_inventory() ? playbook.inventory() : cfg.ansible_inventory(),
            playbook.file(), "-e", input_vars, bp::std_in.close(), "-l",
            playbook.has_limit() ? playbook.limit() : std::string("bots:" + cfg.this_hub()),
            bp::std_out > stdout_file, bp::std_err > stderr, io,
            bp::env["ANSIBLE_CONFIG"] = cfg.ansible_config(),
            bp::env["ANSIBLE_JSON_FILE"] = json_file),
      io_thread([this]() { io.run(); }),
      stdout(stdout_file, std::ios::in),
      json_file(json_file)
{
}

jaiabot::PlaybookRunner::Process::~Process() { io_thread.join(); }

#ifndef LIAISON_UPGRADE_H
#define LIAISON_UPGRADE_H

#include <Wt/Http/Response>
#include <Wt/WFileResource>

#include <chrono>
#include <future>

#include <boost/asio/io_service.hpp>
#include <boost/process.hpp>
#include <boost/process/pipe.hpp>

#include <goby/util/thirdparty/nlohmann/json.hpp>
#include <goby/zeromq/liaison/liaison_container.h>

#include "config.pb.h"

namespace jaiabot
{
class LiaisonUpgrade : public goby::zeromq::LiaisonContainer
{
  public:
    LiaisonUpgrade(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                   Wt::WContainerWidget* parent = 0);

  private:
    class LogFileResource : public Wt::WResource
    {
      public:
        LogFileResource() {}

        void set_last_log(const std::string& log) { last_log_ = log; }

        void handleRequest(const Wt::Http::Request& request, Wt::Http::Response& response) override
        {
            suggestFileName("jaiabot_upgrade_ansible_log_ " + goby::time::file_str() + ".json");
            response.addHeader("Content-Type", "text/plain");
            response.out() << last_log_;
        }

      private:
        std::string last_log_;
    };

    struct AnsiblePlaybookConfig
    {
        AnsiblePlaybookConfig(const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& playbook,
                              LiaisonUpgrade* parent, std::size_t playbook_index);
        AnsiblePlaybookConfig() = delete;
        AnsiblePlaybookConfig(const AnsiblePlaybookConfig&) = delete;
        AnsiblePlaybookConfig(AnsiblePlaybookConfig&&) = default;

        std::string file;
        Wt::WGroupBox* group_box;
        Wt::WContainerWidget* group_div;
        Wt::WContainerWidget* iv_group_div;
        Wt::WContainerWidget* run_button_div;
        Wt::WPushButton* run_button;
        Wt::WContainerWidget* log_button_div;
        Wt::WPushButton* log_button;
        Wt::WContainerWidget* result_div;
        Wt::WText* result_text;
        Wt::WTable* result_table;
        std::vector<std::string>::const_iterator run_text_it;
        // name -> value
        std::map<std::string, std::string> input_var;
        // name -> display name
        std::map<std::string, std::string> output_var;
        std::vector<std::string> output_var_order;

        struct ProcessData
        {
            ProcessData(const protobuf::UpgradeConfig& cfg, const std::string& playbook_file,
                        const std::string& input_vars);
            ~ProcessData();

            boost::asio::io_service io;
            std::future<std::string> stdout;
            boost::process::child process;
            std::thread io_thread;
        };
        std::unique_ptr<ProcessData> pdata;
        std::string last_log;
        std::shared_ptr<LogFileResource> log_resource;
        const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& pb_playbook;
    };
    friend struct AnsiblePlaybookConfig;

    struct Result
    {
        enum ResultType
        {
            FAILURE,
            UNREACHABLE,
            SUCCESS // not FAILURE or UNREACHABLE
        };
        ResultType result{SUCCESS};
        std::map<std::string, std::string> output_vars;
    };

    void run_ansible_playbook(std::size_t playbook_index);
    void set_input_var(int selection_index, Wt::WComboBox* selection, std::string name,
                       std::size_t playbook_index);

    void process_ansible_json_result(nlohmann::json j, AnsiblePlaybookConfig& playbook);

    void loop();
    void focus() override { timer_.start(); }
    void unfocus() override { timer_.stop(); }

  private:
    const protobuf::UpgradeConfig& cfg_;
    std::vector<AnsiblePlaybookConfig> playbooks_;
    Wt::WTimer timer_;
    static const std::vector<std::string> running_;
    static const Wt::WColor color_success_;
    static const Wt::WColor color_failure_;
};

} // namespace jaiabot

#endif

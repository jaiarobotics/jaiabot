#ifndef LIAISON_UPGRADE_H
#define LIAISON_UPGRADE_H

#include <Wt/Http/Response.h>
#include <Wt/WFileResource.h>

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
    LiaisonUpgrade(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg);

  private:
    class LogFileResource : public Wt::WResource
    {
      public:
        LogFileResource() {}

        void set_last_log(const std::string& log) { last_log_ = log; }

        void handleRequest(const Wt::Http::Request& request, Wt::Http::Response& response) override
        {
            suggestFileName("jaiabot_upgrade_ansible_log_" + goby::time::file_str() + ".json");
            response.addHeader("Content-Type", "application/json");
            response.out() << last_log_;
        }

      private:
        std::string last_log_;
    };

    class AutoScrollWidget : public Wt::WContainerWidget
    {
      public:
        AutoScrollWidget()
        {
            this->setOverflow(Wt::Overflow::Auto,
                              Wt::Orientation::Horizontal | Wt::Orientation::Vertical);
            this->setHeight(300);
        }

        void addText(Wt::WString line)
        {
            this->addNew<Wt::WText>(line + "<br/>");

            // JavaScript to scroll to the bottom
            std::string jsCode = "var obj = document.getElementById('" + this->id() +
                                 "'); obj.scrollTop = obj.scrollHeight;";
            Wt::WApplication::instance()->doJavaScript(jsCode);
        }
    };

    struct AnsiblePlaybookConfig
    {
        AnsiblePlaybookConfig(const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& playbook,
                              Wt::WContainerWidget* parent, LiaisonUpgrade* upgrade,
                              std::size_t playbook_index);
        AnsiblePlaybookConfig() = delete;
        AnsiblePlaybookConfig(const AnsiblePlaybookConfig&) = delete;
        AnsiblePlaybookConfig(AnsiblePlaybookConfig&&) = default;

        std::string file;
        std::string stdout_file;
        std::string json_file;

        Wt::WPushButton* run_button{0};
        Wt::WPushButton* log_button{0};
        Wt::WPushButton* stdout_button{0};
        Wt::WText* result_text{0};
        Wt::WTable* result_table{0};
        Wt::WGroupBox* stdout_group{0};
        AutoScrollWidget* stdout_div{0};

        std::vector<std::string>::const_iterator run_text_it;
        // name -> value
        std::map<std::string, std::string> input_var;
        // name -> display name
        std::map<std::string, std::string> output_var;
        std::vector<std::string> output_var_order;

        struct ProcessData
        {
            ProcessData(const protobuf::UpgradeConfig& cfg, const std::string& playbook_file,
                        const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& pb_playbook,
                        const std::string& input_vars, const std::string& ansible_stdout_file,
                        const std::string& ansible_json_file);
            ~ProcessData();

            boost::asio::io_service io;
            std::future<std::string> stderr;
            boost::process::child process;
            std::thread io_thread;
            std::ifstream stdout;
        };
        std::unique_ptr<ProcessData> pdata;
        std::string last_log;
        std::shared_ptr<LogFileResource> log_resource;
        const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& pb_playbook;

        void show_stdout();
        void hide_stdout();
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
    void toggle_stdout(std::size_t playbook_index);

    void loop();
    void focus() override { timer_.start(); }
    void unfocus() override { timer_.stop(); }

  private:
    struct SectionWidgets
    {
        Wt::WPanel* panel;
        Wt::WContainerWidget* div;
    };

    std::map<std::string, SectionWidgets> sections;

    const protobuf::UpgradeConfig& cfg_;
    protobuf::UpgradeConfig::Role role_;
    std::vector<AnsiblePlaybookConfig> playbooks_;
    Wt::WTimer timer_;
    static const std::vector<std::string> running_;
    static const Wt::WColor color_success_;
    static const Wt::WColor color_failure_;
};

} // namespace jaiabot

#endif

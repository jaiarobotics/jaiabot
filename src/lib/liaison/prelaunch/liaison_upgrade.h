#ifndef LIAISON_UPGRADE_H
#define LIAISON_UPGRADE_H

#include <Wt/Http/Response.h>
#include <Wt/WFileResource.h>

#include <cstdint>
#include <memory>

#include <goby/util/thirdparty/nlohmann/json.hpp>
#include <goby/zeromq/liaison/liaison_container.h>

#include "config.pb.h"
#include "playbook_runner.h"

namespace jaiabot
{
class LiaisonUpgrade : public goby::zeromq::LiaisonContainer
{
  public:
    LiaisonUpgrade(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg);
    ~LiaisonUpgrade() override;

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

        template <typename It> void addLines(It begin, It end)
        {
            if (begin == end)
                return;
            for (auto it = begin; it != end; ++it)
                this->addNew<Wt::WText>(Wt::WString::fromUTF8(*it), Wt::TextFormat::Plain)
                    ->setInline(false);

            std::string jsCode = "var obj = document.getElementById('" + this->id() +
                                 "'); obj.scrollTop = obj.scrollHeight;";
            Wt::WApplication::instance()->doJavaScript(jsCode);
        }
    };

    struct AnsiblePlaybookConfig
    {
        AnsiblePlaybookConfig(const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& playbook,
                              int cfg_index, Wt::WContainerWidget* parent, LiaisonUpgrade* upgrade,
                              std::size_t playbook_index);
        AnsiblePlaybookConfig() = delete;
        AnsiblePlaybookConfig(const AnsiblePlaybookConfig&) = delete;
        AnsiblePlaybookConfig(AnsiblePlaybookConfig&&) = default;

        // index into UpgradeConfig::ansible_playbook, which the runner knows it by
        int cfg_index;

        Wt::WPushButton* run_button{0};
        Wt::WPushButton* log_button{0};
        Wt::WPushButton* stdout_button{0};
        Wt::WText* result_text{0};
        Wt::WTable* result_table{0};
        Wt::WGroupBox* stdout_group{0};
        AutoScrollWidget* stdout_div{0};

        // name -> value
        std::map<std::string, std::string> input_var;
        // name -> display name
        std::map<std::string, std::string> output_var;
        std::vector<std::string> output_var_order;

        std::shared_ptr<LogFileResource> log_resource;
        // run_id of the result shown, 0 for none
        std::uint64_t result_run_id{0};
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

    // redirect: send the browser to the reboot page if this run reboots this hub
    void process_ansible_json_result(nlohmann::json j, AnsiblePlaybookConfig& playbook,
                                     bool redirect);
    void toggle_stdout(std::size_t playbook_index);

    // Draws the runner's state; initial when the page is first drawn rather than updated
    void sync(bool initial);
    AnsiblePlaybookConfig* playbook_for(int cfg_index);

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

    PlaybookRunner& runner_;
    int subscription_{-1};
    // Posts from the runner's thread check this is still alive before touching the page
    std::shared_ptr<int> alive_{std::make_shared<int>(0)};
    std::uint64_t run_id_seen_{0};
    // the run this page watched while it ran, so may follow to the reboot page
    std::uint64_t run_id_watched_{0};
    std::size_t lines_shown_{0};
    static const Wt::WColor color_success_;
    static const Wt::WColor color_failure_;
};

} // namespace jaiabot

#endif

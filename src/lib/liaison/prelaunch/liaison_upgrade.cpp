#include <Wt/WApplication.h>
#include <Wt/WComboBox.h>
#include <Wt/WContainerWidget.h>
#include <Wt/WDialog.h>
#include <Wt/WEnvironment.h>
#include <Wt/WGroupBox.h>
#include <Wt/WPanel.h>
#include <Wt/WPushButton.h>
#include <Wt/WServer.h>
#include <Wt/WTable.h>
#include <Wt/WText.h>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

#include "liaison_upgrade.h"

using namespace goby::util::logger;
using goby::glog;

using namespace Wt;
using namespace std::chrono;

constexpr int default_padding{10};

const WColor jaiabot::LiaisonUpgrade::color_success_{"green"};
const WColor jaiabot::LiaisonUpgrade::color_failure_{"red"};

const std::string stdout_button_show_text{"Show Log"};
const std::string stdout_button_hide_text{"Hide Log"};

jaiabot::LiaisonUpgrade::LiaisonUpgrade(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg)
    : cfg_(cfg.GetExtension(protobuf::jaiabot_upgrade_config)),
      runner_(PlaybookRunner::instance(cfg_))
{
    boost::filesystem::create_directories(cfg_.ansible_log_dir());

    // Determine role: if running behind Caddy/Authelia, use the Remote-Groups header;
    // otherwise fall back to the role from the configuration file.
    // Remote-Groups contains a comma-separated list of LLDAP group names.
    const std::string remote_groups = wApp->environment().headerValue("Remote-Groups");
    if (!remote_groups.empty())
    {
        // Parse the comma-separated group list and assign the highest matching role.
        role_ = protobuf::UpgradeConfig::USER;
        std::istringstream ss(remote_groups);
        std::string group;
        while (std::getline(ss, group, ','))
        {
            // trim whitespace
            const auto start = group.find_first_not_of(' ');
            const auto end = group.find_last_not_of(' ');
            if (start == std::string::npos)
                continue;
            group = group.substr(start, end - start + 1);

            if (group == "jcu_developer" || group == "super_admin")
                role_ = protobuf::UpgradeConfig::DEVELOPER;
            else if (group == "jcu_advanced" && role_ < protobuf::UpgradeConfig::ADVANCED)
                role_ = protobuf::UpgradeConfig::ADVANCED;
        }
        glog.is_debug1() && glog << "Using role from Authelia Remote-Groups header ('"
                                 << remote_groups << "'): " << role_ << std::endl;
    }
    else
    {
        role_ = cfg_.role();
        glog.is_debug1() && glog << "Using role from config: " << role_ << std::endl;
    }

    set_name("Fleet Upgrade");

    for (int cfg_index = 0; cfg_index < cfg_.ansible_playbook_size(); ++cfg_index)
    {
        const auto& playbook = cfg_.ansible_playbook(cfg_index);
        if (role_ < playbook.role())
            continue;

        if (!sections.count(playbook.section()))
        {
            SectionWidgets section;
            section.panel = this->addNew<Wt::WPanel>();
            auto div = std::make_unique<Wt::WContainerWidget>();
            section.div = div.get();
            section.panel->setCentralWidget(std::move(div));
            section.panel->setTitle(playbook.section());
            section.panel->setCollapsible(true);
            sections[playbook.section()] = section;
        }

        std::size_t playbook_index = playbooks_.size();
        playbooks_.emplace_back(playbook, cfg_index, sections[playbook.section()].div, this,
                                playbook_index);
    }

    // The runner pushes its changes, so nothing builds up in the browser while the server
    // is out of reach, and a page opened mid-run picks up where the run is
    wApp->enableUpdates(true);
    const std::string session_id = wApp->sessionId();
    std::weak_ptr<int> alive = alive_;
    subscription_ = runner_.subscribe(
        [this, session_id, alive]()
        {
            Wt::WServer::instance()->post(session_id,
                                          [this, alive]()
                                          {
                                              if (!alive.lock())
                                                  return;
                                              sync(false);
                                              wApp->triggerUpdate();
                                          });
        });
    sync(true);
}

jaiabot::LiaisonUpgrade::~LiaisonUpgrade()
{
    runner_.unsubscribe(subscription_);
    alive_.reset();
    if (wApp)
        wApp->enableUpdates(false);
}

jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::AnsiblePlaybookConfig(
    const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& playbook, int cfg_index,
    Wt::WContainerWidget* parent, LiaisonUpgrade* upgrade, std::size_t playbook_index)
    : cfg_index(cfg_index), pb_playbook(playbook)
{
    auto group_box = parent->addNew<WGroupBox>(playbook.name());
    auto group_div = group_box->addNew<WContainerWidget>();
    if (playbook.has_description())
    {
        auto description_div = group_div->addNew<WContainerWidget>();
        description_div->addNew<WText>(playbook.description(), Wt::TextFormat::Plain);
        description_div->setPadding(default_padding);
    }
    auto iv_group_div = group_div->addNew<WContainerWidget>();
    auto run_button_div = group_div->addNew<WContainerWidget>();
    run_button = run_button_div->addNew<WPushButton>("Run");
    auto stdout_button_div = group_div->addNew<WContainerWidget>();
    stdout_button = stdout_button_div->addNew<WPushButton>(stdout_button_show_text);
    auto log_button_div = group_div->addNew<WContainerWidget>();
    log_button = log_button_div->addNew<WPushButton>("Download Log");
    auto result_div = group_div->addNew<WContainerWidget>();
    result_text = result_div->addNew<WText>("");
    result_table = result_div->addNew<WTable>();
    stdout_group = group_div->addNew<WGroupBox>("Details");
    stdout_div = stdout_group->addNew<AutoScrollWidget>();

    result_text->setTextFormat(Wt::TextFormat::Plain);

    stdout_group->hide();

    run_button_div->setInline(true);
    run_button_div->setPadding(default_padding);
    log_button_div->setInline(true);
    log_button_div->setPadding(default_padding);
    stdout_button_div->setInline(true);
    stdout_button_div->setPadding(default_padding);
    iv_group_div->setPadding(default_padding);
    result_div->setPadding(default_padding);

    run_button->clicked().connect([=]() { upgrade->run_ansible_playbook(playbook_index); });
    log_button->disable();
    log_resource = std::make_shared<LogFileResource>();
    log_button->setLink(Wt::WLink(log_resource));

    stdout_button->clicked().connect([=]() { upgrade->toggle_stdout(playbook_index); });

    result_table->decorationStyle().setBorder(Wt::WBorder(Wt::BorderStyle::Solid, 1));

    for (const auto& iv : playbook.input_var())
    {
        if (iv.has_static_value())
        {
            input_var[iv.name()] = iv.static_value();
        }
        else
        {
            auto iv_div = iv_group_div->addNew<WContainerWidget>();
            auto iv_text = iv_div->addNew<WText>(iv.display_name() + ": ");
            auto iv_selection = iv_div->addNew<WComboBox>();
            for (const std::string& v : iv.value()) iv_selection->addItem(v);
            iv_selection->activated().connect(
                [=](int index)
                { upgrade->set_input_var(index, iv_selection, iv.name(), playbook_index); });
            if (iv.value_size() > 0)
                input_var[iv.name()] = iv.value(0);
        }
    }

    for (const auto& ov : playbook.output_var())
    {
        output_var[ov.name()] = ov.display_name();
        output_var_order.push_back(ov.name());
    }
}

void jaiabot::LiaisonUpgrade::run_ansible_playbook(std::size_t playbook_index)
{
    AnsiblePlaybookConfig& playbook = playbooks_[playbook_index];

    if (playbook.pb_playbook.confirmation_required())
    {
        WDialog dialog("Confirm executing: " + playbook.pb_playbook.name());

        auto ok = dialog.contents()->addNew<WPushButton>("Run");
        auto cancel = dialog.contents()->addNew<WPushButton>("Cancel");

        dialog.rejectWhenEscapePressed();
        ok->clicked().connect(&dialog, &WDialog::accept);
        cancel->clicked().connect(&dialog, &WDialog::reject);

        if (dialog.exec() != Wt::DialogCode::Accepted)
            return;
    }

    std::string error;
    bool started = runner_.start(playbook.cfg_index, playbook.input_var, error);
    // catches up first, or a run started while the confirmation was open would clear the error
    sync(false);
    if (!started)
        playbook.result_text->setText(error);
}

void jaiabot::LiaisonUpgrade::toggle_stdout(std::size_t playbook_index)
{
    AnsiblePlaybookConfig& playbook = playbooks_[playbook_index];
    if (playbook.stdout_group->isHidden())
        playbook.show_stdout();
    else
        playbook.hide_stdout();
}

void jaiabot::LiaisonUpgrade::set_input_var(int selection_index, Wt::WComboBox* selection,
                                            std::string name, std::size_t playbook_index)
{
    AnsiblePlaybookConfig& playbook = playbooks_[playbook_index];
    const auto& value = selection->itemText(selection_index).narrow();
    glog.is_debug1() && glog << "Setting extra var " << name << "=" << value << std::endl;
    playbook.input_var[name] = value;
}

jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig* jaiabot::LiaisonUpgrade::playbook_for(int cfg_index)
{
    for (auto& playbook : playbooks_)
        if (playbook.cfg_index == cfg_index)
            return &playbook;
    // hidden from this user's role
    return nullptr;
}

void jaiabot::LiaisonUpgrade::sync(bool initial)
{
    runner_.read(
        [&](const PlaybookRunner::State& state)
        {
            if (state.run_id != run_id_seen_)
            {
                // a run started since this page last looked, as pressing Run did here
                run_id_seen_ = state.run_id;
                lines_shown_ = 0;
                for (auto& playbook : playbooks_)
                {
                    playbook.result_table->clear();
                    playbook.result_text->setText("");
                    playbook.hide_stdout();
                    playbook.stdout_div->clear();
                }
            }

            AnsiblePlaybookConfig* current = playbook_for(state.playbook);
            if (current && state.lines.size() > lines_shown_)
            {
                current->stdout_div->addLines(state.lines.begin() + lines_shown_,
                                              state.lines.end());
                lines_shown_ = state.lines.size();
            }

            for (auto& playbook : playbooks_)
            {
                if (state.running)
                    playbook.run_button->disable();
                else
                    playbook.run_button->enable();
            }

            if (state.running)
            {
                run_id_watched_ = state.run_id;
                if (current)
                {
                    std::time_t started = std::chrono::system_clock::to_time_t(state.started);
                    std::stringstream text;
                    text << "Running since " << std::put_time(std::gmtime(&started), "%H:%M:%S")
                         << " UTC";
                    for (const auto& v : state.input_vars)
                        text << ", " << v.first << "=" << v.second;
                    current->result_text->setText(text.str());
                    current->log_button->disable();
                    if (initial)
                        current->show_stdout();
                }
            }

            for (const auto& finished_p : state.finished)
            {
                AnsiblePlaybookConfig* playbook = playbook_for(finished_p.first);
                const auto& finished = finished_p.second;
                if (!playbook || playbook->result_run_id == finished.run_id)
                    continue;
                playbook->result_run_id = finished.run_id;
                playbook->result_text->setText("");
                playbook->result_table->clear();
                playbook->log_resource->set_last_log(finished.download_log);
                playbook->log_button->enable();
                try
                {
                    process_ansible_json_result(nlohmann::json::parse(finished.json), *playbook,
                                                !initial && finished.run_id == run_id_watched_);
                }
                catch (const std::exception& e)
                {
                    glog.is_warn() && glog << "Failed to parse output: " << e.what() << std::endl;
                    playbook->result_text->setText(
                        "Failed to parse log file. Please download log to see result.");
                }
            }
        });
}

void jaiabot::LiaisonUpgrade::process_ansible_json_result(nlohmann::json root_json,
                                                          AnsiblePlaybookConfig& playbook,
                                                          bool redirect)
{
    // host -> result
    std::map<std::string, Result> results;
    auto set_failed_unreachable = [&results](const nlohmann::json j, std::string host)
    {
        if (j.contains("unreachable") && j["unreachable"].get<bool>())
            results[host].result = jaiabot::LiaisonUpgrade::Result::UNREACHABLE;

        if (j.contains("failed") && j["failed"].get<bool>())
            results[host].result = jaiabot::LiaisonUpgrade::Result::FAILURE;
    };

    for (const auto& play : root_json["plays"])
    {
        for (const auto& task : play["tasks"])
        {
            for (const auto& host_el : task["hosts"].items())
            {
                std::string host = host_el.key();
                nlohmann::json hostvalues = host_el.value();
                if (!results.count(host))
                    results.insert(std::make_pair(host, Result{}));

                set_failed_unreachable(hostvalues, host);
                if (hostvalues.contains("results"))
                {
                    for (const auto& result : hostvalues["results"])
                        set_failed_unreachable(result, host);
                }

                if (hostvalues.contains("ansible_facts"))
                {
                    for (const auto& facts_el : hostvalues["ansible_facts"].items())
                    {
                        if (playbook.output_var.count(facts_el.key()))
                            results[host].output_vars[facts_el.key()] =
                                facts_el.value().is_string() ? facts_el.value().get<std::string>()
                                                             : facts_el.value().dump(2);
                    }
                }
            }
        }
    }

    auto set_style = [](WTableCell* cell, bool header = false)
    {
        cell->setPadding(default_padding);
        if (header)
            cell->decorationStyle().font().setWeight(Wt::FontWeight::Bold);
        cell->decorationStyle().setBorder(Wt::WBorder(Wt::BorderStyle::Solid, 1));
    };

    auto* result_table = playbook.result_table;

    int column = 0;
    int row = 0;
    result_table->elementAt(row, column)->addWidget(std::make_unique<Wt::WText>("Host Name"));
    set_style(result_table->elementAt(row, column), true);
    ++column;
    result_table->elementAt(row, column)->addWidget(std::make_unique<Wt::WText>("Status"));
    set_style(result_table->elementAt(row, column), true);
    for (const auto& ov : playbook.output_var_order)
    {
        ++column;
        result_table->elementAt(row, column)
            ->addWidget(std::make_unique<Wt::WText>(playbook.output_var.at(ov)));
        set_style(result_table->elementAt(row, column), true);
    }

    bool this_hub_success = false;
    for (const auto& result_p : results)
    {
        column = 0;
        ++row;
        result_table->elementAt(row, column)
            ->addWidget(std::make_unique<Wt::WText>(result_p.first));
        set_style(result_table->elementAt(row, column));

        ++column;
        Wt::WTableCell* cell = result_table->elementAt(row, column);
        set_style(cell);
        cell->decorationStyle().setBackgroundColor(
            result_p.second.result == jaiabot::LiaisonUpgrade::Result::SUCCESS ? color_success_
                                                                               : color_failure_);

        switch (result_p.second.result)
        {
            case jaiabot::LiaisonUpgrade::Result::SUCCESS:
                cell->addWidget(std::make_unique<Wt::WText>("Success"));
                if (result_p.first == cfg_.this_hub())
                    this_hub_success = true;
                break;
            case jaiabot::LiaisonUpgrade::Result::FAILURE:
                cell->addWidget(std::make_unique<Wt::WText>("Failure"));
                break;
            case jaiabot::LiaisonUpgrade::Result::UNREACHABLE:
                cell->addWidget(std::make_unique<Wt::WText>("Unreachable"));
                break;
        }

        for (const auto& ov : playbook.output_var_order)
        {
            ++column;
            if (result_p.second.output_vars.count(ov))
            {
                result_table->elementAt(row, column)
                    ->addWidget(std::make_unique<Wt::WText>(result_p.second.output_vars.at(ov)));
            }

            set_style(result_table->elementAt(row, column));
        }
    }

    if (redirect && this_hub_success && playbook.pb_playbook.causes_hub_reboot())
    {
        // Only the browser knows the address it reached the JCU by (behind Caddy, the
        // CloudHub's https://run.<base>/jcu/); Apache serves the reboot page on that site,
        // or on port 80 when the JCU was opened on its own port
        wApp->doJavaScript(
            "(function() {"
            "  var l = window.location;"
            "  var site = l.port === '9091' ? 'http://' + l.hostname : l.origin;"
            "  l.href = site + '/reboot-check/index.html?return=' + encodeURIComponent(l.href);"
            "})();");
    }
}

void jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::show_stdout()
{
    stdout_group->show();
    stdout_button->setText(stdout_button_hide_text);
}
void jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::hide_stdout()
{
    stdout_group->hide();
    stdout_button->setText(stdout_button_show_text);
}

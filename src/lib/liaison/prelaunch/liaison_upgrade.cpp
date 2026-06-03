#include <Wt/WComboBox.h>
#include <Wt/WContainerWidget.h>
#include <Wt/WDialog.h>
#include <Wt/WEnvironment.h>
#include <Wt/WGroupBox.h>
#include <Wt/WPanel.h>
#include <Wt/WPushButton.h>
#include <Wt/WTable.h>
#include <Wt/WText.h>
#include <chrono>

#include "liaison_upgrade.h"

#if __has_include(<boost/process/v1.hpp>)
namespace bp = boost::process::v1;
#else
namespace bp = boost::process;
#endif

using namespace goby::util::logger;
using goby::glog;

using namespace Wt;
using namespace std::chrono;

constexpr int default_padding{10};

const std::vector<std::string> jaiabot::LiaisonUpgrade::running_({
    "Running",
    "Running .",
    "Running ..",
    "Running ...",
    "Running ....",
    "Running .....",
    "Running ......",
    "Running .......",
    "Running ........",
    "Running .........",
    "Running ..........",
    "Running ...........",
});

const WColor jaiabot::LiaisonUpgrade::color_success_{"green"};
const WColor jaiabot::LiaisonUpgrade::color_failure_{"red"};

const std::string stdout_button_show_text{"Show Log"};
const std::string stdout_button_hide_text{"Hide Log"};

jaiabot::LiaisonUpgrade::LiaisonUpgrade(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg)
    : cfg_(cfg.GetExtension(protobuf::jaiabot_upgrade_config))
{
    boost::filesystem::create_directories(cfg_.ansible_log_dir());

    set_name("Fleet Upgrade");
    const auto update_freq = cfg_.check_freq();
    timer_.setInterval(std::chrono::milliseconds(static_cast<long>(1.0 / update_freq * 1.0e3)));
    timer_.timeout().connect(this, &LiaisonUpgrade::loop);

    for (const auto& playbook : cfg_.ansible_playbook())
    {
        if (cfg_.role() < playbook.role())
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
        playbooks_.emplace_back(playbook, sections[playbook.section()].div, this, playbook_index);
    }
}

jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::AnsiblePlaybookConfig(
    const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& playbook, Wt::WContainerWidget* parent,
    LiaisonUpgrade* upgrade, std::size_t playbook_index)
    : file(playbook.file()),
      run_text_it(jaiabot::LiaisonUpgrade::running_.begin()),
      pb_playbook(playbook)
{
    auto group_box = parent->addNew<WGroupBox>(playbook.name());
    auto group_div = group_box->addNew<WContainerWidget>();
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

    glog.is_debug1() && glog << "Running playbook: " << playbook.file << std::endl;
    for (auto& playbook : playbooks_)
    {
        playbook.result_table->clear();
        playbook.hide_stdout();
    }

    try
    {
        playbook.stdout_div->clear();

        boost::filesystem::path playbook_path(playbook.file);
        playbook.stdout_file =
            cfg_.ansible_log_dir() + "/" + playbook_path.stem().native() + "_stdout.txt";
        playbook.json_file =
            cfg_.ansible_log_dir() + "/" + playbook_path.stem().native() + "_result.json";

        // for some reason boost process won't overwrite this file unless it's removed first
        boost::filesystem::remove(playbook.stdout_file);

        std::string input_vars;
        for (const auto& p : playbook.input_var) input_vars += p.first + "=" + p.second + " ";
        playbook.pdata.reset(new AnsiblePlaybookConfig::ProcessData(
            cfg_, playbook.file, playbook.pb_playbook, input_vars, playbook.stdout_file,
            playbook.json_file));
    }
    catch (const std::exception& e)
    {
        glog.is_warn() && glog << "Failed to run ansible-playbook: " << e.what() << std::endl;
    }

    for (auto& playbook : playbooks_) playbook.run_button->disable();
    playbook.log_button->disable();
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

void jaiabot::LiaisonUpgrade::loop()
{
    for (auto& playbook : playbooks_)
    {
        if (playbook.pdata)
        {
            if (playbook.pdata->process.running())
            {
                ++playbook.run_text_it;
                if (playbook.run_text_it == running_.end())
                    playbook.run_text_it = running_.begin();
                playbook.result_text->setText(*playbook.run_text_it);

                std::string line;
                while (std::getline(playbook.pdata->stdout, line))
                    playbook.stdout_div->addText(Wt::WString(line));

                if (playbook.pdata->stdout.eof())
                    playbook.pdata->stdout.clear();

                playbook.pdata->stdout.seekg(0, std::ios::cur);
            }
            else
            {
                std::ifstream json_log(playbook.json_file, std::ios::in);
                playbook.last_log.clear();
                {
                    std::string line;
                    while (std::getline(json_log, line)) playbook.last_log += line + "\n";
                }

                nlohmann::json j_stdout_stderr;
                j_stdout_stderr["__stderr"] = playbook.pdata->stderr.get();
                playbook.pdata->stdout.seekg(0, std::ios::beg);
                j_stdout_stderr["__stdout"] = nlohmann::json::array();

                {
                    std::string line;
                    while (std::getline(playbook.pdata->stdout, line))
                        j_stdout_stderr["__stdout"].push_back(line);
                }

                playbook.log_resource->set_last_log(playbook.last_log + "\n" +
                                                    j_stdout_stderr.dump(2));

                try
                {
                    auto j = nlohmann::json::parse(playbook.last_log);
                    process_ansible_json_result(j, playbook);
                    j.update(j_stdout_stderr);
                    // if parsed, succesfully, use this as the log
                    playbook.log_resource->set_last_log(j.dump(2));
                }
                catch (const std::exception& e)
                {
                    glog.is_warn() && glog << "Failed to parse output: " << e.what() << std::endl;
                    playbook.result_text->setText(
                        "Failed to parse log file. Please download log to see result.");
                }

                playbook.pdata.reset();
                for (auto& playbook : playbooks_) playbook.run_button->enable();
                playbook.log_button->enable();
            }
        }
    }
}

void jaiabot::LiaisonUpgrade::process_ansible_json_result(nlohmann::json root_json,
                                                          AnsiblePlaybookConfig& playbook)
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

    bool hub_success = false;
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
                if (result_p.first.find("hub") != std::string::npos)
                    hub_success = true;
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

    if (hub_success && playbook.pb_playbook.causes_hub_reboot())
    {
        std::string hostname = wApp->environment().hostName();
        if (auto pos = hostname.find(':'))
            hostname = hostname.substr(0, pos);
        wApp->redirect("http://" + hostname + "/reboot-check/index.html");
    }

    playbook.result_text->setText("");
}

//
// ProcessData
//
jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::ProcessData::ProcessData(
    const protobuf::UpgradeConfig& cfg, const std::string& playbook_file,
    const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& pb_playbook,
    const std::string& input_vars, const std::string& ansible_stdout_file,
    const std::string& ansible_json_file)

    : process(cfg.has_ansible_playbook_full_path()
                  ? boost::filesystem::path(cfg.ansible_playbook_full_path())
                  : bp::search_path("ansible-playbook"),
              "-i", pb_playbook.has_inventory() ? pb_playbook.inventory() : cfg.ansible_inventory(),
              playbook_file, "-e", input_vars, bp::std_in.close(), "-l",
              pb_playbook.has_limit() ? pb_playbook.limit() : std::string("bots:" + cfg.this_hub()),
              bp::std_out > ansible_stdout_file, bp::std_err > stderr, io,
              bp::env["ANSIBLE_CONFIG"] = cfg.ansible_config(),
              bp::env["ANSIBLE_JSON_FILE"] = ansible_json_file),
      io_thread([this]() { io.run(); }),
      stdout(ansible_stdout_file, std::ios::in)
{
}

jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::ProcessData::~ProcessData() { io_thread.join(); }

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

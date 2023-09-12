#include <Wt/WComboBox>
#include <Wt/WContainerWidget>
#include <Wt/WGroupBox>
#include <Wt/WPushButton>
#include <Wt/WTable>
#include <Wt/WText>
#include <chrono>

#include <boost/process.hpp>
#include <boost/process/async.hpp>

#include "liaison_upgrade.h"

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

jaiabot::LiaisonUpgrade::LiaisonUpgrade(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                                        Wt::WContainerWidget* parent)
    : cfg_(cfg.GetExtension(protobuf::jaiabot_upgrade_config))
{
    set_name("Fleet Upgrade");
    const auto update_freq = cfg_.check_freq();
    timer_.setInterval(1.0 / update_freq * 1.0e3);
    timer_.timeout().connect(this, &LiaisonUpgrade::loop);

    for (const auto& playbook : cfg_.ansible_playbook())
    {
        if (cfg_.role() < playbook.role())
            continue;

        std::size_t playbook_index = playbooks_.size();
        playbooks_.emplace_back(playbook, this, playbook_index);
    }
}

jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::AnsiblePlaybookConfig(
    const jaiabot::protobuf::UpgradeConfig::AnsiblePlaybook& playbook, LiaisonUpgrade* parent,
    std::size_t playbook_index)
    : file(playbook.file()),
      group_box(new WGroupBox(playbook.name(), parent)),
      group_div(new WContainerWidget(group_box)),
      iv_group_div(new WContainerWidget(group_div)),
      run_button_div(new WContainerWidget(group_div)),
      run_button(new WPushButton("Run", run_button_div)),
      log_button_div(new WContainerWidget(group_div)),
      log_button(new WPushButton("Download Log", log_button_div)),
      result_div(new WContainerWidget(group_div)),
      result_text(new WText("", result_div)),
      result_table(new WTable(result_div)),
      run_text_it(jaiabot::LiaisonUpgrade::running_.begin())
{
    run_button_div->setInline(true);
    run_button_div->setPadding(default_padding);
    log_button_div->setInline(true);
    log_button_div->setPadding(default_padding);
    iv_group_div->setPadding(default_padding);
    result_div->setPadding(default_padding);

    run_button->clicked().connect(
        boost::bind(&LiaisonUpgrade::run_ansible_playbook, parent, playbook_index));
    log_button->disable();
    log_resource = std::make_shared<LogFileResource>();
    log_button->setLink(Wt::WLink(log_resource.get()));

    result_table->decorationStyle().setBorder(Wt::WBorder(Wt::WBorder::Solid, 1));

    for (const auto& iv : playbook.input_var())
    {
        auto* iv_div = new WContainerWidget(iv_group_div);
        auto* iv_text = new WText(iv.display_name() + ": ", iv_div);
        auto* iv_selection = new WComboBox(iv_div);
        for (const std::string& v : iv.value()) iv_selection->addItem(v);
        iv_selection->activated().connect(boost::bind(&LiaisonUpgrade::set_input_var, parent,
                                                      boost::placeholders::_1, iv_selection,
                                                      iv.name(), playbook_index));
        if (iv.value_size() > 0)
            input_var[iv.name()] = iv.value(0);
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
    glog.is_debug1() && glog << "Running playbook: " << playbook.file << std::endl;
    playbook.result_table->clear();

    try
    {
        std::string input_vars;
        for (const auto& p : playbook.input_var) input_vars += p.first + "=" + p.second + " ";
        playbook.pdata.reset(
            new AnsiblePlaybookConfig::ProcessData(cfg_, playbook.file, input_vars));
    }
    catch (const std::exception& e)
    {
        glog.is_warn() && glog << "Failed to run ansible-playbook: " << e.what() << std::endl;
    }

    for (auto& playbook : playbooks_) playbook.run_button->disable();
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
            }
            else
            {
                playbook.last_log = playbook.pdata->stdout.get();
                playbook.log_resource->set_last_log(playbook.last_log);

                try
                {
                    process_ansible_json_result(nlohmann::json::parse(playbook.last_log), playbook);
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
                                                             : facts_el.value().dump();
                    }
                }
            }
        }
    }

    auto set_style = [](WTableCell* cell, bool header = false)
    {
        cell->setPadding(default_padding);
        if (header)
            cell->decorationStyle().font().setWeight(Wt::WFont::Bold);
        cell->decorationStyle().setBorder(Wt::WBorder(Wt::WBorder::Solid, 1));
    };

    auto* result_table = playbook.result_table;

    int column = 0;
    int row = 0;
    result_table->elementAt(row, column)->addWidget(new Wt::WText("Host Name"));
    set_style(result_table->elementAt(row, column), true);
    ++column;
    result_table->elementAt(row, column)->addWidget(new Wt::WText("Status"));
    set_style(result_table->elementAt(row, column), true);
    for (const auto& ov : playbook.output_var_order)
    {
        ++column;
        result_table->elementAt(row, column)->addWidget(new Wt::WText(playbook.output_var.at(ov)));
        set_style(result_table->elementAt(row, column), true);
    }

    for (const auto& result_p : results)
    {
        column = 0;
        ++row;
        result_table->elementAt(row, column)->addWidget(new Wt::WText(result_p.first));
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
                cell->addWidget(new Wt::WText("Success"));
                break;
            case jaiabot::LiaisonUpgrade::Result::FAILURE:
                cell->addWidget(new Wt::WText("Failure"));
                break;
            case jaiabot::LiaisonUpgrade::Result::UNREACHABLE:
                cell->addWidget(new Wt::WText("Unreachable"));
                break;
        }

        for (const auto& ov : playbook.output_var_order)
        {
            ++column;
            if (result_p.second.output_vars.count(ov))
            {
                result_table->elementAt(row, column)
                    ->addWidget(new Wt::WText(result_p.second.output_vars.at(ov)));
            }

            set_style(result_table->elementAt(row, column));
        }
    }

    playbook.result_text->setText("");
}

//
// ProcessData
//
jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::ProcessData::ProcessData(
    const protobuf::UpgradeConfig& cfg, const std::string& playbook_file,
    const std::string& input_vars)

    : process(boost::process::search_path("ansible-playbook"), "-i", cfg.ansible_inventory(),
              playbook_file, "-e", input_vars, boost::process::std_in.close(), "-l",
              "bots:" + cfg.this_hub(), boost::process::std_out > stdout, io,
              boost::process::env["ANSIBLE_CONFIG"] = cfg.ansible_config()),
      io_thread([this]() { io.run(); })
{
}

jaiabot::LiaisonUpgrade::AnsiblePlaybookConfig::ProcessData::~ProcessData() { io_thread.join(); }

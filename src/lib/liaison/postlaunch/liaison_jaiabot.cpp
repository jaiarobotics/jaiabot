#include <Wt/WComboBox.h>
#include <Wt/WContainerWidget.h>
#include <Wt/WDateTime.h>
#include <Wt/WGroupBox.h>
#include <Wt/WHBoxLayout.h>
#include <Wt/WLabel.h>
#include <Wt/WPanel.h>
#include <Wt/WSlider.h>
#include <Wt/WStackedWidget.h>
#include <Wt/WStandardItem.h>
#include <Wt/WStandardItemModel.h>
#include <Wt/WVBoxLayout.h>
#include <chrono>

#include "liaison_jaiabot.h"

using namespace goby::util::logger;
using goby::glog;

using namespace Wt;
using namespace std::chrono;

bool jaiabot::LiaisonJaiabot::dive_start_ = false;
bool led_switch_on = true;
const size_t MAX_DATA_POINTS = 1000;
system_clock::time_point jaiabot::LiaisonJaiabot::dive_expire_ = system_clock::now();

jaiabot::LiaisonJaiabot::LiaisonJaiabot(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                                        Wt::WContainerWidget* parent)
    : goby::zeromq::LiaisonContainerWithComms<LiaisonJaiabot, CommsThread>(cfg),
      cfg_(cfg.GetExtension(protobuf::jaiabot_config))
{
    auto hub_vehicle_panel = this->addNew<Wt::WPanel>();
    hub_vehicle_panel->setTitle("Hub");
    hub_vehicle_panel->setCollapsible(true);
    hub_vehicle_panel->setCollapsed(cfg_.minimize_hub_panel());

    wApp->globalKeyWentDown().connect([this](WKeyEvent key) { key_press(key); });
    this->keyWentDown().connect([this](WKeyEvent key) { key_press(key); });

    wApp->globalKeyWentUp().connect([this](WKeyEvent key) { key_release(key); });
    this->keyWentUp().connect([this](WKeyEvent key) { key_release(key); });

    auto hub_vehicle_box = std::make_unique<Wt::WContainerWidget>();
    hub_vehicle_box->addNew<WLabel>("Bot: ");
    vehicle_combo_ = hub_vehicle_box->addNew<WComboBox>();
    vehicle_combo_->addItem("(Choose a vehicle)");
    vehicle_combo_->sactivated().connect([this](Wt::WString msg) { vehicle_select(msg); });

    vehicle_stack_ = hub_vehicle_box->addNew<Wt::WStackedWidget>();

    hub_vehicle_panel->setCentralWidget(std::move(hub_vehicle_box));

    vehicle_stack_->hide();

    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
    {
        auto bot_panel = this->addNew<Wt::WPanel>();
        bot_panel->setTitle("Bot");
        bot_panel->setCollapsible(true);
        bot_panel->setCollapsed(cfg_.minimize_bot_panel());

        auto bot_box = std::make_unique<Wt::WContainerWidget>();

        auto bot_node_status_box = bot_box->addNew<WGroupBox>("Node Status from Fusion");
        bot_node_status_text_ = bot_node_status_box->addNew<WText>();
        auto bot_low_control_box = bot_box->addNew<WGroupBox>("Control Command");
        bot_low_control_text_ = bot_low_control_box->addNew<WText>();
        auto bot_pt_box = bot_box->addNew<WGroupBox>("Pressure & Temperature");
        bot_pt_text_ = bot_pt_box->addNew<WText>();
        auto bot_salinity_box = bot_box->addNew<WGroupBox>("Salinity");
        bot_salinity_text_ = bot_salinity_box->addNew<WText>();
        auto bot_imu_box = bot_box->addNew<WGroupBox>("IMU");
        bot_imu_text_ = bot_imu_box->addNew<WText>();
        auto bot_tpv_box = bot_box->addNew<WGroupBox>("Time Position Velocity");
        bot_tpv_text_ = bot_tpv_box->addNew<WText>();

        bot_panel->setCentralWidget(std::move(bot_box));

        auto chart_panel = this->addNew<Wt::WPanel>();
        chart_panel->setTitle("Charts");
        chart_panel->setCollapsible(true);
        chart_panel->setCollapsed(cfg_.minimize_chart_panel());

        auto chart_container = std::make_unique<Wt::WContainerWidget>();
        chart_container->addNew<WLabel>("Data: ");
        data_combo_ = chart_container->addNew<WComboBox>();
        data_combo_->addItem("(Choose a data type)");
        data_combo_->sactivated().connect([this](Wt::WString msg) { data_select(msg); });

        for (auto data_type : data_types_) add_data_type(data_type);

        chart_box = chart_container->addNew<WGroupBox>("");
        chart_box->hide();

        data_stack_ = chart_box->addNew<Wt::WStackedWidget>();

        chart_container->setMinimumSize(Wt::WLength::Auto, 100);
        chart_panel->setCentralWidget(std::move(chart_container));
    }

    const auto update_freq = cfg_.control_freq();
    timer_.setInterval(std::chrono::milliseconds(static_cast<long>(1.0 / update_freq * 1.0e3)));
    timer_.timeout().connect([this]() { loop(); });

    set_name("JaiaBot");

    for (auto node_id : cfg_.load_vehicle()) check_add_vehicle(node_id);
}

void jaiabot::LiaisonJaiabot::check_add_vehicle(int node_id)
{
    auto it = vehicle_data_.find(node_id);
    if (it == vehicle_data_.end())
    {
        it = vehicle_data_
                 .emplace(
                     std::make_pair(node_id, std::make_unique<VehicleData>(vehicle_stack_, cfg_)))
                 .first;

        vehicle_combo_->addItem(std::to_string(node_id));
        vehicle_combo_->model()->sort(0);
    }

    auto& vehicle_data = it->second;
}

void jaiabot::LiaisonJaiabot::vehicle_select(WString msg)
{
    std::string m = msg.narrow();
    int vehicle = goby::util::as<int>(m);

    if (vehicle_data_.count(vehicle))
    {
        vehicle_stack_->show();
        vehicle_stack_->setCurrentIndex(vehicle_data_.at(vehicle)->index_in_stack);
        current_vehicle_ = vehicle;
    }
    else
    {
        vehicle_stack_->hide();
        current_vehicle_ = -1;
    }
}

void jaiabot::LiaisonJaiabot::add_data_type(std::pair<std::string, YAxisConfig>& data_type)
{
    //Add the data type to the chart_data_ vector
    ChartData chart_data;
    chart_data.chart_type = data_type.first;
    chart_data.y_axis_config = data_type.second;
    chart_data_.push_back(chart_data);

    //Add the data type to the data combo box
    data_combo_->addItem(data_type.first);
    data_combo_->model()->sort(0);
}

void jaiabot::LiaisonJaiabot::data_select(WString msg)
{
    std::string data_type = msg.narrow();

    // Check if selected data_type is available as a chart type
    auto it_data_type =
        std::find_if(data_types_.begin(), data_types_.end(),
                     [data_type](const auto& item) { return item.first == data_type; });

    if (it_data_type == data_types_.end())
    {
        chart_box->hide();
        current_data_type_ = "";
        return;
    }

    chart_box->show();
    chart_box->setTitle(data_type);

    auto it =
        std::find_if(chart_data_.begin(), chart_data_.end(),
                     [&data_type](const ChartData& data) { return data.chart_type == data_type; });

    // Early exit if there's no chart data for the selected data type
    if (it == chart_data_.end())
        return;

    if (current_data_type_ == data_type && chart_model_ && chart_)
    {
        size_t num_points = it->data_points.size();

        int current_rows = chart_model_->rowCount();
        int target_rows = static_cast<int>(num_points);

        if (current_rows < target_rows)
        {
            chart_model_->insertRows(current_rows, target_rows - current_rows);
        }
        else if (current_rows > target_rows)
        {
            chart_model_->removeRows(target_rows, current_rows - target_rows);
        }

        // Update the values in place
        int row = 0;
        for (const auto& [x_val, y_val] : it->data_points)
        {
            chart_model_->setData(row, 0, get_date_time(x_val));
            chart_model_->setData(row, 1, y_val);
            row++;
        }

        return;
    }

    current_data_type_ = data_type;

    auto temp_model = std::make_shared<Wt::WStandardItemModel>(it->data_points.size(), 2);

    int row = 0;
    for (const auto& [x_val, y_val] : it->data_points)
    {
        temp_model->setData(row, 0, get_date_time(x_val));
        temp_model->setData(row, 1, y_val);
        row++;
    }

    chart_model_ = temp_model;

    auto new_chart = std::make_unique<Wt::Chart::WCartesianChart>();
    new_chart->setModel(chart_model_);
    new_chart->setType(Wt::Chart::ChartType::Scatter);
    new_chart->setXSeriesColumn(0);

    YAxisConfig y_config = it->y_axis_config;
    new_chart->axis(Wt::Chart::Axis::Y).setTitle(Wt::WString(y_config.title));
    new_chart->axis(Wt::Chart::Axis::Y).setTitleOrientation(Wt::Orientation::Vertical);
    new_chart->setPlotAreaPadding(60, Wt::Side::Bottom);
    new_chart->setPlotAreaPadding(60, Wt::Side::Left);

    auto series = std::make_unique<Wt::Chart::WDataSeries>(1, Wt::Chart::SeriesType::Line);
    new_chart->addSeries(std::move(series));

    auto& x_axis = new_chart->axis(Wt::Chart::Axis::X);
    x_axis.setTitle(Wt::WString("Time"));
    x_axis.setScale(Wt::Chart::AxisScale::DateTime);
    x_axis.setLabelFormat("hh:mm:ss");
    x_axis.setLabelInterval(0.0);

    new_chart->resize(600, 400);
    new_chart->setTitle(data_type + " Chart");
    new_chart->setMargin(15, Wt::Side::Top | Wt::Side::Right | Wt::Side::Left);
    new_chart->setMargin(5, Wt::Side::Bottom);

    chart_ = new_chart.get();

    data_stack_->clear();
    data_stack_->addWidget(std::move(new_chart));
    data_stack_->show();
}

Wt::WDateTime jaiabot::LiaisonJaiabot::get_date_time(goby::time::MicroTime mp)
{
    const auto current_time = goby::time::convert<std::chrono::system_clock::time_point>(mp);
    return Wt::WDateTime::fromTimePoint(current_time);
}

void jaiabot::LiaisonJaiabot::add_data_point(std::string data_type, double data_point)
{
    auto it =
        std::find_if(chart_data_.begin(), chart_data_.end(),
                     [&data_type](const ChartData& data) { return data.chart_type == data_type; });

    if (it != chart_data_.end())
    {
        auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
        it->data_points[now] = data_point;

        if (it->data_points.size() > MAX_DATA_POINTS)
            it->data_points.erase(
                it->data_points.begin()); // Remove the oldest data point to maintain the size limit
    }
}

void jaiabot::LiaisonJaiabot::loop()
{
    auto it = vehicle_data_.find(current_vehicle_);
    if (it != vehicle_data_.end())
    {
        jaiabot::protobuf::LowControl cmd_msg;

        auto& cmd = *cmd_msg.mutable_control_surfaces();

        static std::atomic<int> id(0);

        if (dive_start_)
        {
            dive_expire_ = system_clock::now() +
                           seconds(it->second->low_level_control.timeout_slider->value());
            dive_start_ = false;
        }

        cmd_msg.set_id(id++);
        cmd_msg.set_vehicle(current_vehicle_);
        cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        cmd.set_timeout(it->second->low_level_control.timeout_slider->value());
        cmd.set_port_elevator(it->second->low_level_control.port_elevator_slider->value());
        cmd.set_stbd_elevator(it->second->low_level_control.stbd_elevator_slider->value());
        cmd.set_rudder(it->second->low_level_control.rudder_slider->value());
        if (system_clock::now() < dive_expire_)
        {
            cmd.set_motor(it->second->low_level_control.dive_slider->value());
        }
        else if (motor_go_)
        {
            cmd.set_motor(it->second->low_level_control.motor_slider->value());
        }
        else
        {
            cmd.set_motor(0);
        }

        cmd.set_led_switch_on(led_switch_on);

        glog.is_debug1() && glog << cmd_msg.ShortDebugString() << std::endl;

        this->post_to_comms(
            [=]() { goby_thread()->interprocess().publish<groups::low_control>(cmd_msg); });

        auto& ack = it->second->low_level_control.latest_ack;
        if (ack.IsInitialized())
        {
            auto time_since_ack =
                goby::time::SystemClock::now<goby::time::MicroTime>() - ack.time_with_units();

            it->second->low_level_control.ack_text->setText(
                std::string("Time since ack: ") +
                std::to_string(goby::time::SITime(time_since_ack).value()) +
                std::string("s<br/><pre>") + ack.DebugString() + "</pre>");
        }
    }
    if (!current_data_type_.empty())
    {
        // Refresh chart with new data points
        data_select(current_data_type_);
    }
}

void jaiabot::LiaisonJaiabot::post_control_ack(const protobuf::LowControlAck& ack)
{
    glog.is_debug1() && glog << ack.ShortDebugString() << std::endl;
    auto it = vehicle_data_.find(ack.vehicle());
    if (it != vehicle_data_.end())
    {
        it->second->low_level_control.latest_ack = ack;
    }
}

void jaiabot::LiaisonJaiabot::post_node_status(
    const goby::middleware::frontseat::protobuf::NodeStatus& node_status)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_node_status_text_->setText("<pre>" + node_status.DebugString() + "</pre>");
}

void jaiabot::LiaisonJaiabot::post_tpv(
    const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_tpv_text_->setText("<pre>" + tpv.DebugString() + "</pre>");
}

void jaiabot::LiaisonJaiabot::post_pt(const jaiabot::protobuf::PressureTemperatureData& pt)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
    {
        bot_pt_text_->setText("<pre>" + pt.DebugString() + "</pre>");

        // Add the data points to the chart data structure
        add_data_point("Temperature", pt.temperature());
        add_data_point("Pressure", pt.pressure_raw());
    }
}

void jaiabot::LiaisonJaiabot::post_salinity(const jaiabot::protobuf::SalinityData& salinity)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
    {
        bot_salinity_text_->setText("<pre>" + salinity.DebugString() + "</pre>");

        auto steady_now = goby::time::SteadyClock::now();
        double mission_time =
            std::chrono::duration_cast<std::chrono::duration<double>>(steady_now.time_since_epoch())
                .count();

        add_data_point("Salinity", salinity.salinity());
    }
}

void jaiabot::LiaisonJaiabot::post_imu(const jaiabot::protobuf::IMUData& imu)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_imu_text_->setText("<pre>" + imu.DebugString() + "</pre>");
}

void jaiabot::LiaisonJaiabot::post_low_control(const jaiabot::protobuf::LowControl& low_control)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_low_control_text_->setText("<pre>" + low_control.DebugString() + "</pre>");
}

jaiabot::LiaisonJaiabot::VehicleData::VehicleData(Wt::WStackedWidget* vehicle_stack,
                                                  const protobuf::JaiabotConfig& cfg)
    : vehicle_div(new Wt::WContainerWidget), low_level_control(vehicle_div.get(), cfg)
{
    vehicle_stack->addWidget(std::move(vehicle_div));
    // index of the newly added widget
    index_in_stack = vehicle_stack->count() - 1;
}

jaiabot::LiaisonJaiabot::VehicleData::Controls::Controls(Wt::WContainerWidget* vehicle_div,
                                                         const protobuf::JaiabotConfig& cfg)

{
    auto controls_box = vehicle_div->addNew<WGroupBox>(
        "Low Level Controls ('C' clears values to defaults (except timeout))");
    auto timeout_box = controls_box->addNew<WGroupBox>("Timeout");
    timeout_slider = timeout_box->addNew<WSlider>(Wt::Orientation::Horizontal);
    auto timeout_text_box = timeout_box->addNew<WContainerWidget>();
    timeout_text =
        timeout_text_box->addNew<WText>(timeout_text_from_value(timeout_slider->value()));
    std::cout << "after creation: " << timeout_text << std::endl;

    auto dive_box = controls_box->addNew<WGroupBox>("Dive");
    auto dive_button_box = dive_box->addNew<WContainerWidget>();
    auto dive_button = dive_button_box->addNew<WPushButton>("Dive");
    auto dive_slider_box = dive_box->addNew<WContainerWidget>();
    dive_slider = dive_slider_box->addNew<WSlider>(Wt::Orientation::Horizontal);
    auto dive_text_box = dive_box->addNew<WContainerWidget>();
    dive_text = dive_text_box->addNew<WText>(dive_text_from_value(dive_slider->value()));
    auto motor_box = controls_box->addNew<WGroupBox>("Motor");
    auto motor_left_text = motor_box->addNew<WText>(cfg.motor_bounds().min_label());
    motor_slider = motor_box->addNew<WSlider>(Wt::Orientation::Horizontal);
    auto motor_right_text = motor_box->addNew<WText>(cfg.motor_bounds().max_label());
    auto motor_text_box = motor_box->addNew<WContainerWidget>();
    motor_text = motor_text_box->addNew<WText>(motor_text_from_value(motor_slider->value()));
    auto fins_box = controls_box->addNew<WGroupBox>("Fins");
    port_elevator_slider = fins_box->addNew<WSlider>(Wt::Orientation::Vertical);
    auto rudder_left_text = fins_box->addNew<WText>(cfg.rudder_bounds().min_label());
    rudder_slider = fins_box->addNew<WSlider>(Wt::Orientation::Horizontal);
    auto rudder_right_text = fins_box->addNew<WText>(cfg.rudder_bounds().max_label());
    stbd_elevator_slider = fins_box->addNew<WSlider>(Wt::Orientation::Vertical);
    auto fins_text_box = fins_box->addNew<WContainerWidget>();
    fins_text = fins_box->addNew<WText>(fins_text_from_value(
        port_elevator_slider->value(), stbd_elevator_slider->value(), rudder_slider->value()));
    auto ack_box = controls_box->addNew<WGroupBox>("Ack");
    ack_text = ack_box->addNew<WText>("No acks received");

    timeout_slider->setMinimum(cfg.timeout_bounds().min());
    timeout_slider->setMaximum(cfg.timeout_bounds().max());
    timeout_slider->setTickInterval((cfg.timeout_bounds().max() - cfg.timeout_bounds().min()) /
                                    cfg.timeout_bounds().n_ticks());
    timeout_slider->setTickPosition(Wt::WSlider::TickPosition::TicksBelow);
    timeout_slider->sliderMoved().connect([this](int value)
                                          { timeout_slider_moved(value, this->timeout_text); });

    timeout_text->setText(timeout_text_from_value(timeout_slider->value()));

    dive_slider->setMinimum(cfg.motor_bounds().min());
    dive_slider->setMaximum(0);
    dive_slider->setTickInterval((0 - cfg.motor_bounds().min()) / cfg.motor_bounds().n_ticks());
    dive_slider->setTickPosition(Wt::WSlider::TickPosition::TicksBelow);
    dive_slider->sliderMoved().connect([this](int value) { dive_slider_moved(value, dive_text); });
    dive_slider->setValue(0);

    dive_text->setText(dive_text_from_value(dive_slider->value()));

    dive_button->clicked().connect([this](Wt::WMouseEvent) { dive_button_clicked(); });

    motor_slider->setMinimum(0);
    motor_slider->setMaximum(cfg.motor_bounds().max());
    motor_slider->setTickInterval((cfg.motor_bounds().max() - 0) / cfg.motor_bounds().n_ticks());
    motor_slider->setTickPosition(Wt::WSlider::TickPosition::TicksBelow);
    motor_slider->sliderMoved().connect([this](int value)
                                        { motor_slider_moved(value, motor_text); });

    port_elevator_slider->setMinimum(cfg.elevator_bounds().min());
    port_elevator_slider->setMaximum(cfg.elevator_bounds().max());
    port_elevator_slider->setTickInterval(
        (cfg.elevator_bounds().max() - cfg.elevator_bounds().min()) /
        cfg.elevator_bounds().n_ticks());
    port_elevator_slider->setTickPosition(Wt::WSlider::TickPosition::TicksRight);
    port_elevator_slider->sliderMoved().connect(
        [this](int value)
        { port_elevator_slider_moved(value, fins_text, stbd_elevator_slider, rudder_slider); });

    stbd_elevator_slider->setMinimum(cfg.elevator_bounds().min());
    stbd_elevator_slider->setMaximum(cfg.elevator_bounds().max());
    stbd_elevator_slider->setTickInterval(
        (cfg.elevator_bounds().max() - cfg.elevator_bounds().min()) /
        cfg.elevator_bounds().n_ticks());
    stbd_elevator_slider->setTickPosition(Wt::WSlider::TickPosition::TicksLeft);
    stbd_elevator_slider->sliderMoved().connect(
        [this](int value)
        { stbd_elevator_slider_moved(value, fins_text, port_elevator_slider, rudder_slider); });

    rudder_slider->setMinimum(cfg.rudder_bounds().min());
    rudder_slider->setMaximum(cfg.rudder_bounds().max());
    rudder_slider->setTickInterval((cfg.rudder_bounds().max() - cfg.rudder_bounds().min()) /
                                   cfg.rudder_bounds().n_ticks());
    rudder_slider->setTickPosition(Wt::WSlider::TickPosition::TicksBelow);
    rudder_slider->sliderMoved().connect(
        [this](int value)
        { rudder_slider_moved(value, fins_text, port_elevator_slider, stbd_elevator_slider); });
}

void jaiabot::LiaisonJaiabot::key_press(WKeyEvent key)
{
    glog.is_debug1() && glog << "Key pressed: " << static_cast<int>(key.key()) << std::endl;
    auto it = vehicle_data_.find(current_vehicle_);
    if (it != vehicle_data_.end())
    {
        auto& control = it->second->low_level_control;
        switch (key.key())
        {
            default: break;
            case Key::Q: // port elevator +
                control.set_port_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                break;
            case Key::A: // port elevator -
                control.set_port_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;
            case Key::T: // stbd elevator +
                control.set_stbd_elevator_value(control.stbd_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                break;
            case Key::G: // stbd elevator -
                control.set_stbd_elevator_value(control.stbd_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;

            case Key::E: // elevator +
                control.set_port_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                control.set_stbd_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());

                break;
            case Key::D: // elevator -
                control.set_port_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                control.set_stbd_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;
            case Key::F: // rudder +
                control.set_rudder_value(control.rudder_slider->value() +
                                         cfg_.rudder_bounds().step());

                break;
            case Key::S: // rudder -
                control.set_rudder_value(control.rudder_slider->value() -
                                         cfg_.rudder_bounds().step());

                break;
            case Key::R: // motor +
                if (motor_go_)
                {
                    control.set_motor_value(control.motor_slider->value() +
                                            cfg_.motor_bounds().step());
                }
                break;
            case Key::W: // motor -
                if (motor_go_)
                {
                    control.set_motor_value(control.motor_slider->value() -
                                            cfg_.motor_bounds().step());
                }
                break;
            case Key::U: // dive +
                control.set_dive_value(control.dive_slider->value() + cfg_.motor_bounds().step());

                break;
            case Key::Y: // dive -
                control.set_dive_value(control.dive_slider->value() - cfg_.motor_bounds().step());

                break;
            case Key::V: // timeout +
                control.set_timeout_value(control.timeout_slider->value() +
                                          cfg_.timeout_bounds().step());

                break;
            case Key::X: // timeout -
                control.set_timeout_value(control.timeout_slider->value() -
                                          cfg_.timeout_bounds().step());

                break;
            case Key::C: // reset all except timeout
                // control.set_timeout_value(cfg_.timeout_bounds().center());
                control.set_motor_value(cfg_.motor_bounds().center());
                control.set_rudder_value(cfg_.rudder_bounds().center());
                control.set_port_elevator_value(cfg_.elevator_bounds().center());
                control.set_stbd_elevator_value(cfg_.elevator_bounds().center());
                control.set_dive_value(0);
                break;
            case Key::Shift: // dead man switch
                motor_go_ = true;
                break;
        }
    }
}

void jaiabot::LiaisonJaiabot::key_release(WKeyEvent key)
{
    glog.is_debug1() && glog << "Key released: " << static_cast<int>(key.key()) << std::endl;
    auto it = vehicle_data_.find(current_vehicle_);
    if (it != vehicle_data_.end())
    {
        auto& control = it->second->low_level_control;
        switch (key.key())
        {
            default: break;
            case Key::Shift: // dead man switch
                control.set_motor_value(0);
                motor_go_ = false;
                break;
        }
    }
}

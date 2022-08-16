#include <Wt/WComboBox>
#include <Wt/WContainerWidget>
#include <Wt/WGroupBox>
#include <Wt/WLabel>
#include <Wt/WPanel>
#include <Wt/WSlider>
#include <Wt/WStackedWidget>
#include <chrono>

#include "liaison_jaiabot.h"

using namespace goby::util::logger;
using goby::glog;

using namespace Wt;
using namespace std::chrono;

bool jaiabot::LiaisonJaiabot::dive_start_ = false;
bool led_switch_on = true;
system_clock::time_point jaiabot::LiaisonJaiabot::dive_expire_ = system_clock::now();

jaiabot::LiaisonJaiabot::LiaisonJaiabot(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                                        Wt::WContainerWidget* parent)
    : goby::zeromq::LiaisonContainerWithComms<LiaisonJaiabot, CommsThread>(cfg),
      cfg_(cfg.GetExtension(protobuf::jaiabot_config))
{
    WPanel* hub_vehicle_panel = new Wt::WPanel(this);
    hub_vehicle_panel->setTitle("Hub");
    hub_vehicle_panel->setCollapsible(true);
    hub_vehicle_panel->setCollapsed(cfg_.minimize_hub_panel());

    wApp->globalKeyWentDown().connect(boost::bind(&LiaisonJaiabot::key_press, this, _1));
    this->keyWentDown().connect(boost::bind(&LiaisonJaiabot::key_press, this, _1));

    wApp->globalKeyWentUp().connect(boost::bind(&LiaisonJaiabot::key_release, this, _1));
    this->keyWentUp().connect(boost::bind(&LiaisonJaiabot::key_release, this, _1));

    WContainerWidget* hub_vehicle_box = new Wt::WContainerWidget();
    hub_vehicle_panel->setCentralWidget(hub_vehicle_box);
    new WLabel("Bot: ", hub_vehicle_box);
    vehicle_combo_ = new WComboBox(hub_vehicle_box);
    vehicle_combo_->addItem("(Choose a vehicle)");
    vehicle_combo_->sactivated().connect(this, &LiaisonJaiabot::vehicle_select);

    vehicle_stack_ = new Wt::WStackedWidget(hub_vehicle_box);
    vehicle_stack_->hide();

    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
    {
        WPanel* bot_panel = new Wt::WPanel(this);
        bot_panel->setTitle("Bot");
        bot_panel->setCollapsible(true);
        bot_panel->setCollapsed(cfg_.minimize_bot_panel());

        WContainerWidget* bot_box = new Wt::WContainerWidget();
        bot_panel->setCentralWidget(bot_box);

        bot_node_status_box_ = new WGroupBox("Node Status from Fusion", bot_box);
        bot_node_status_text_ = new WText(bot_node_status_box_);
        bot_low_control_box_ = new WGroupBox("Control Command", bot_box);
        bot_low_control_text_ = new WText(bot_low_control_box_);
        bot_pt_box_ = new WGroupBox("Pressure & Temperature", bot_box);
        bot_pt_text_ = new WText(bot_pt_box_);
        bot_salinity_box_ = new WGroupBox("Salinity", bot_box);
        bot_salinity_text_ = new WText(bot_salinity_box_);
        bot_imu_box_ = new WGroupBox("IMU", bot_box);
        bot_imu_text_ = new WText(bot_imu_box_);
        bot_tpv_box_ = new WGroupBox("Time Position Velocity", bot_box);
        bot_tpv_text_ = new WText(bot_tpv_box_);
    }

    const auto update_freq = cfg_.control_freq();
    timer_.setInterval(1.0 / update_freq * 1.0e3);
    timer_.timeout().connect(this, &LiaisonJaiabot::loop);

    set_name("JaiaBot");

    for (auto node_id : cfg_.load_vehicle()) check_add_vehicle(node_id);
}

void jaiabot::LiaisonJaiabot::check_add_vehicle(int node_id)
{
    auto it = vehicle_data_.find(node_id);
    if (it == vehicle_data_.end())
    {
        it = vehicle_data_.insert(std::make_pair(node_id, VehicleData(vehicle_stack_, cfg_))).first;

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
        vehicle_stack_->setCurrentIndex(vehicle_data_.at(vehicle).index_in_stack);
        current_vehicle_ = vehicle;
    }
    else
    {
        vehicle_stack_->hide();
        current_vehicle_ = -1;
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
            dive_expire_ =
                system_clock::now() + seconds(it->second.low_level_control.timeout_slider->value());
            dive_start_ = false;
        }

        cmd_msg.set_id(id++);
        cmd_msg.set_vehicle(current_vehicle_);
        cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        cmd.set_timeout(it->second.low_level_control.timeout_slider->value());
        cmd.set_port_elevator(it->second.low_level_control.port_elevator_slider->value());
        cmd.set_stbd_elevator(it->second.low_level_control.stbd_elevator_slider->value());
        cmd.set_rudder(it->second.low_level_control.rudder_slider->value());
        if (system_clock::now() < dive_expire_)
        {
            cmd.set_motor(it->second.low_level_control.dive_slider->value());
        }
        else if (motor_go_)
        {
            cmd.set_motor(it->second.low_level_control.motor_slider->value());
        }
        else
        {
            cmd.set_motor(0);
        }

        cmd.set_led_switch_on(led_switch_on);

        glog.is_debug1() && glog << cmd_msg.ShortDebugString() << std::endl;

        this->post_to_comms(
            [=]() { goby_thread()->interprocess().publish<groups::low_control>(cmd_msg); });

        auto& ack = it->second.low_level_control.latest_ack;
        if (ack.IsInitialized())
        {
            auto time_since_ack =
                goby::time::SystemClock::now<goby::time::MicroTime>() - ack.time_with_units();

            it->second.low_level_control.ack_text->setText(
                std::string("Time since ack: ") +
                std::to_string(goby::time::SITime(time_since_ack).value()) +
                std::string("s<br/><pre>") + ack.DebugString() + "</pre>");
        }
    }
}

void jaiabot::LiaisonJaiabot::post_control_ack(const protobuf::LowControlAck& ack)
{
    glog.is_debug1() && glog << ack.ShortDebugString() << std::endl;
    auto it = vehicle_data_.find(ack.vehicle());
    if (it != vehicle_data_.end())
    {
        it->second.low_level_control.latest_ack = ack;
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
        bot_pt_text_->setText("<pre>" + pt.DebugString() + "</pre>");
}

void jaiabot::LiaisonJaiabot::post_salinity(const jaiabot::protobuf::SalinityData& salinity)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_salinity_text_->setText("<pre>" + salinity.DebugString() + "</pre>");
}

void jaiabot::LiaisonJaiabot::post_imu(const jaiabot::protobuf::IMUData& imu)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_imu_text_->setText("<pre>" + imu.DebugString() + "</pre>");
}

void jaiabot::LiaisonJaiabot::post_low_control(
    const jaiabot::protobuf::LowControl& low_control)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_low_control_text_->setText("<pre>" + low_control.DebugString() + "</pre>");
}

jaiabot::LiaisonJaiabot::VehicleData::VehicleData(Wt::WStackedWidget* vehicle_stack,
                                                  const protobuf::JaiabotConfig& cfg)
    : vehicle_div(new Wt::WContainerWidget), low_level_control(vehicle_div, cfg)
{
    vehicle_stack->addWidget(vehicle_div);
    // index of the newly added widget
    index_in_stack = vehicle_stack->count() - 1;
}

jaiabot::LiaisonJaiabot::VehicleData::Controls::Controls(Wt::WContainerWidget* vehicle_div,
                                                         const protobuf::JaiabotConfig& cfg)
    : controls_box(new WGroupBox(
          "Low Level Controls ('C' clears values to defaults (except timeout))", vehicle_div)),
      timeout_box(new WGroupBox("Timeout", controls_box)),
      timeout_slider(new WSlider(Horizontal, timeout_box)),
      timeout_text_box(new WContainerWidget(timeout_box)),
      timeout_text(new WText(timeout_text_from_value(timeout_slider->value()), timeout_text_box)),
      dive_box(new WGroupBox("Dive", controls_box)),
      dive_button_box(new WContainerWidget(dive_box)),
      dive_button(new WPushButton("Dive", dive_button_box)),
      dive_slider_box(new WContainerWidget(dive_box)),
      dive_slider(new WSlider(Horizontal, dive_slider_box)),
      dive_text_box(new WContainerWidget(dive_box)),
      dive_text(new WText(dive_text_from_value(dive_slider->value()), dive_text_box)),
      motor_box(new WGroupBox("Motor", controls_box)),
      motor_left_text(new WText(cfg.motor_bounds().min_label(), motor_box)),
      motor_slider(new WSlider(Horizontal, motor_box)),
      motor_right_text(new WText(cfg.motor_bounds().max_label(), motor_box)),
      motor_text_box(new WContainerWidget(motor_box)),
      motor_text(new WText(motor_text_from_value(motor_slider->value()), motor_text_box)),
      fins_box(new WGroupBox("Fins", controls_box)),
      port_elevator_slider(new WSlider(Vertical, fins_box)),
      rudder_left_text(new WText(cfg.rudder_bounds().min_label(), fins_box)),
      rudder_slider(new WSlider(Horizontal, fins_box)),
      rudder_right_text(new WText(cfg.rudder_bounds().max_label(), fins_box)),
      stbd_elevator_slider(new WSlider(Vertical, fins_box)),
      fins_text_box(new WContainerWidget(fins_box)),
      fins_text(
          new WText(fins_text_from_value(port_elevator_slider->value(),
                                         stbd_elevator_slider->value(), rudder_slider->value()),
                    fins_box)),
      ack_box(new WGroupBox("Ack", controls_box)),
      ack_text(new WText("No acks received", ack_box))

{
    timeout_slider->setMinimum(cfg.timeout_bounds().min());
    timeout_slider->setMaximum(cfg.timeout_bounds().max());
    timeout_slider->setTickInterval((cfg.timeout_bounds().max() - cfg.timeout_bounds().min()) /
                                    cfg.timeout_bounds().n_ticks());
    timeout_slider->setTickPosition(Wt::WSlider::TicksBelow);
    timeout_slider->sliderMoved().connect(boost::bind(
        &LiaisonJaiabot::VehicleData::Controls::timeout_slider_moved, _1, timeout_text));

    timeout_text->setText(timeout_text_from_value(timeout_slider->value()));

    dive_slider->setMinimum(cfg.motor_bounds().min());
    dive_slider->setMaximum(0);
    dive_slider->setTickInterval((0 - cfg.motor_bounds().min()) / cfg.motor_bounds().n_ticks());
    dive_slider->setTickPosition(Wt::WSlider::TicksBelow);
    dive_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::dive_slider_moved, _1, dive_text));
    dive_slider->setValue(0);

    dive_text->setText(dive_text_from_value(dive_slider->value()));

    dive_button->clicked().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::dive_button_clicked, _1));

    motor_slider->setMinimum(0);
    motor_slider->setMaximum(cfg.motor_bounds().max());
    motor_slider->setTickInterval((cfg.motor_bounds().max() - 0) / cfg.motor_bounds().n_ticks());
    motor_slider->setTickPosition(Wt::WSlider::TicksBelow);
    motor_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::motor_slider_moved, _1, motor_text));

    port_elevator_slider->setMinimum(cfg.elevator_bounds().min());
    port_elevator_slider->setMaximum(cfg.elevator_bounds().max());
    port_elevator_slider->setTickInterval(
        (cfg.elevator_bounds().max() - cfg.elevator_bounds().min()) /
        cfg.elevator_bounds().n_ticks());
    port_elevator_slider->setTickPosition(Wt::WSlider::TicksRight);
    port_elevator_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::port_elevator_slider_moved, _1,
                    fins_text, stbd_elevator_slider, rudder_slider));

    stbd_elevator_slider->setMinimum(cfg.elevator_bounds().min());
    stbd_elevator_slider->setMaximum(cfg.elevator_bounds().max());
    stbd_elevator_slider->setTickInterval(
        (cfg.elevator_bounds().max() - cfg.elevator_bounds().min()) /
        cfg.elevator_bounds().n_ticks());
    stbd_elevator_slider->setTickPosition(Wt::WSlider::TicksLeft);
    stbd_elevator_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::stbd_elevator_slider_moved, _1,
                    fins_text, port_elevator_slider, rudder_slider));

    rudder_slider->setMinimum(cfg.rudder_bounds().min());
    rudder_slider->setMaximum(cfg.rudder_bounds().max());
    rudder_slider->setTickInterval((cfg.rudder_bounds().max() - cfg.rudder_bounds().min()) /
                                   cfg.rudder_bounds().n_ticks());
    rudder_slider->setTickPosition(Wt::WSlider::TicksBelow);
    rudder_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::rudder_slider_moved, _1, fins_text,
                    port_elevator_slider, stbd_elevator_slider));
}

void jaiabot::LiaisonJaiabot::key_press(WKeyEvent key)
{
    glog.is_debug1() && glog << "Key pressed: " << key.key() << std::endl;
    auto it = vehicle_data_.find(current_vehicle_);
    if (it != vehicle_data_.end())
    {
        auto& control = it->second.low_level_control;
        switch (key.key())
        {
            default: break;
            case Key_Q: // port elevator +
                control.set_port_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                break;
            case Key_A: // port elevator -
                control.set_port_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;
            case Key_T: // stbd elevator +
                control.set_stbd_elevator_value(control.stbd_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                break;
            case Key_G: // stbd elevator -
                control.set_stbd_elevator_value(control.stbd_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;

            case Key_E: // elevator +
                control.set_port_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                control.set_stbd_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());

                break;
            case Key_D: // elevator -
                control.set_port_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                control.set_stbd_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;
            case Key_F: // rudder +
                control.set_rudder_value(control.rudder_slider->value() +
                                         cfg_.rudder_bounds().step());

                break;
            case Key_S: // rudder -
                control.set_rudder_value(control.rudder_slider->value() -
                                         cfg_.rudder_bounds().step());

                break;
            case Key_R: // motor +
                if (motor_go_)
                {
                    control.set_motor_value(control.motor_slider->value() +
                                            cfg_.motor_bounds().step());
                }
                break;
            case Key_W: // motor -
                if (motor_go_)
                {
                    control.set_motor_value(control.motor_slider->value() -
                                            cfg_.motor_bounds().step());
                }
                break;
            case Key_U: // dive +
                control.set_dive_value(control.dive_slider->value() + cfg_.motor_bounds().step());

                break;
            case Key_Y: // dive -
                control.set_dive_value(control.dive_slider->value() - cfg_.motor_bounds().step());

                break;
            case Key_V: // timeout +
                control.set_timeout_value(control.timeout_slider->value() +
                                          cfg_.timeout_bounds().step());

                break;
            case Key_X: // timeout -
                control.set_timeout_value(control.timeout_slider->value() -
                                          cfg_.timeout_bounds().step());

                break;
            case Key_C: // reset all except timeout
                // control.set_timeout_value(cfg_.timeout_bounds().center());
                control.set_motor_value(cfg_.motor_bounds().center());
                control.set_rudder_value(cfg_.rudder_bounds().center());
                control.set_port_elevator_value(cfg_.elevator_bounds().center());
                control.set_stbd_elevator_value(cfg_.elevator_bounds().center());
                control.set_dive_value(0);
                break;
            case Key_Shift: // dead man switch
                motor_go_ = true;
                break;
        }
    }
}

void jaiabot::LiaisonJaiabot::key_release(WKeyEvent key)
{
    glog.is_debug1() && glog << "Key released: " << key.key() << std::endl;
    auto it = vehicle_data_.find(current_vehicle_);
    if (it != vehicle_data_.end())
    {
        auto& control = it->second.low_level_control;
        switch (key.key())
        {
            default: break;
            case Key_Shift: // dead man switch
                control.set_motor_value(0);
                motor_go_ = false;
                break;
        }
    }
}

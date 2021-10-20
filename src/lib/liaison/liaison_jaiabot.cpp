#include "liaison_jaiabot.h"

using namespace goby::util::logger;
using goby::glog;

using namespace Wt;
using namespace std::chrono;

bool jaiabot::LiaisonJaiabot::dive_start_ = false;
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

    WContainerWidget* hub_vehicle_cont = new Wt::WContainerWidget();
    hub_vehicle_panel->setCentralWidget(hub_vehicle_cont);
    new WLabel("Bot: ", hub_vehicle_cont);
    vehicle_combo_ = new WComboBox(hub_vehicle_cont);
    vehicle_combo_->addItem("(Choose a vehicle)");
    vehicle_combo_->sactivated().connect(this, &LiaisonJaiabot::vehicle_select);

    vehicle_stack_ = new Wt::WStackedWidget(hub_vehicle_cont);
    vehicle_stack_->hide();

    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
    {
        WPanel* bot_panel = new Wt::WPanel(this);
        bot_panel->setTitle("Bot");
        bot_panel->setCollapsible(true);
        bot_panel->setCollapsed(cfg_.minimize_bot_panel());

        WContainerWidget* bot_cont = new Wt::WContainerWidget();
        bot_panel->setCentralWidget(bot_cont);

        bot_top_cont_ = new WContainerWidget(bot_cont);
        bot_vehicle_command_box_ = new WGroupBox("Vehicle Command", bot_top_cont_);
        bot_vehicle_command_text_ = new WText(bot_vehicle_command_box_);
        bot_node_status_box_ = new WGroupBox("Node Status from Fusion", bot_top_cont_);
        bot_node_status_text_ = new WText(bot_node_status_box_);
        bot_imu_box_ = new WGroupBox("IMU", bot_top_cont_);
        bot_imu_text_ = new WText(bot_imu_box_);
        bot_sensor_box_ = new WGroupBox("Sensors", bot_top_cont_);
        bot_pt_box_ = new WGroupBox("Pressure & Temperature", bot_sensor_box_);
        bot_pt_text_ = new WText(bot_pt_box_);
        bot_salinity_box_ = new WGroupBox("Salinity", bot_sensor_box_);
        bot_salinity_text_ = new WText(bot_salinity_box_);
        bot_tpv_box_ = new WGroupBox("Time Position Velocity", bot_cont);
        bot_tpv_text_ = new WText(bot_tpv_box_);
        bot_vehicle_command_box_->setInline(true);
        bot_node_status_box_->setInline(true);
        bot_imu_box_->setInline(true);
        bot_sensor_box_->setInline(true);
    }

    const auto update_freq = cfg_.control_freq();
    timer_.setInterval(1.0 / update_freq * 1.0e3);
    timer_.timeout().connect(this, &LiaisonJaiabot::loop);

    set_name("JaiaBot");

    for (auto vehicle_id : cfg_.load_vehicle()) check_add_vehicle(vehicle_id);
}

void jaiabot::LiaisonJaiabot::check_add_vehicle(int vehicle_id)
{
    auto it = vehicle_data_.find(vehicle_id);
    if (it == vehicle_data_.end())
    {
        it = vehicle_data_.insert(std::make_pair(vehicle_id, VehicleData(vehicle_stack_, cfg_)))
                 .first;

        vehicle_combo_->addItem(std::to_string(vehicle_id));
        vehicle_combo_->model()->sort(0);
    }

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
        jaiabot::protobuf::VehicleCommand vehicle_command;

        auto& low_level_command = *vehicle_command.mutable_low_level_command();
        auto& pid_command = *vehicle_command.mutable_helm_command();
        auto& dive_command = *vehicle_command.mutable_dive_command();

        auto& vehicle_data = it->second;
        auto& controls = vehicle_data.controls;

        static std::atomic<int> id(0);

        if (dive_start_)
        {
            dive_expire_ = system_clock::now() + seconds(controls.timeout_slider->value());
            dive_start_ = false;
        }

        vehicle_command.set_id(id++);
        vehicle_command.set_vehicle(current_vehicle_);
        vehicle_command.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

        switch (*controls.command_mode)
        {
            case VehicleData::Controls::low_level_command:
                std::cout << "low level" << std::endl;

                low_level_command.set_timeout(controls.timeout_slider->value());
                low_level_command.set_port_elevator(controls.port_elevator_slider->value());
                low_level_command.set_stbd_elevator(controls.stbd_elevator_slider->value());
                low_level_command.set_rudder(controls.rudder_slider->value());
                if (system_clock::now() < dive_expire_)
                {
                    low_level_command.set_motor(controls.dive_slider->value());
                }
                else if (motor_go_)
                {
                    low_level_command.set_motor(controls.thrust_slider->value());
                }
                else
                {
                    low_level_command.set_motor(0);
                }
                break;

            case VehicleData::Controls::pid_command: std::cout << "pid" << std::endl; break;
            case VehicleData::Controls::dive_command:
                // Not implemented yet
                std::cout << "dive" << std::endl;
                break;
            default: std::cout << "default" << std::endl; break;
        }

        glog.is_debug1() && glog << vehicle_command.ShortDebugString() << std::endl;

        this->post_to_comms([=]() {
            goby_thread()->interprocess().publish<groups::vehicle_command>(vehicle_command);
        });

        auto& ack = controls.latest_ack;
        if (ack.IsInitialized())
        {
            auto time_since_ack =
                goby::time::SystemClock::now<goby::time::MicroTime>() - ack.time_with_units();

            controls.ack_text->setText(std::string("Time since ack: ") +
                                       std::to_string(goby::time::SITime(time_since_ack).value()) +
                                       std::string("s<br/><pre>") + ack.DebugString() + "</pre>");
        }
    }
}

void jaiabot::LiaisonJaiabot::post_control_ack(const protobuf::ControlAck& ack)
{
    glog.is_debug1() && glog << ack.ShortDebugString() << std::endl;
    auto it = vehicle_data_.find(ack.vehicle());
    auto& vehicle_data = it->second;
    auto& controls = vehicle_data.controls;
    if (it != vehicle_data_.end())
    {
        controls.latest_ack = ack;
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

void jaiabot::LiaisonJaiabot::post_pt(const jaiabot::protobuf::PTData& pt)
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

void jaiabot::LiaisonJaiabot::post_vehicle_command(
    const jaiabot::protobuf::VehicleCommand& vehicle_command)
{
    if (cfg_.mode() == protobuf::JaiabotConfig::BOT)
        bot_vehicle_command_text_->setText("<pre>" + vehicle_command.DebugString() + "</pre>");
}

jaiabot::LiaisonJaiabot::VehicleData::VehicleData(Wt::WStackedWidget* vehicle_stack,
                                                  const protobuf::JaiabotConfig& cfg)
    : vehicle_cont(new Wt::WContainerWidget), controls(vehicle_cont, cfg)
{
    vehicle_stack->addWidget(vehicle_cont);
    // index of the newly added widget
    index_in_stack = vehicle_stack->count() - 1;
}

jaiabot::LiaisonJaiabot::VehicleData::Controls::Controls(Wt::WContainerWidget* vehicle_cont,
                                                         const protobuf::JaiabotConfig& cfg)
    : button_box(new WGroupBox("Buttons!", vehicle_cont)),
      button_group(new WButtonGroup(button_box)),
      button_low_level(new WRadioButton("Low Level Control", button_box)),
      button_pid(new WRadioButton("PID", button_box)),
      button_dive(new WRadioButton("Dive", button_box)),
      low_level_box(new WGroupBox("Low Level ('C' clears values to defaults (except timeout))",
                                  vehicle_cont)),
      timeout_dive_thrust_cont(new WContainerWidget(low_level_box)),
      timeout_box(new WGroupBox("Timeout", timeout_dive_thrust_cont)),
      timeout_slider(new WSlider(Horizontal, timeout_box)),
      timeout_text_cont(new WContainerWidget(timeout_box)),
      timeout_text(new WText(timeout_text_from_value(timeout_slider->value()), timeout_text_cont)),
      thrust_box(new WGroupBox("Thrust", timeout_dive_thrust_cont)),
      thrust_left_text(new WText(cfg.motor_bounds().min_label(), thrust_box)),
      thrust_slider(new WSlider(Horizontal, thrust_box)),
      thrust_right_text(new WText(cfg.motor_bounds().max_label(), thrust_box)),
      thrust_text_cont(new WContainerWidget(thrust_box)),
      thrust_text(new WText(thrust_text_from_value(thrust_slider->value()), thrust_text_cont)),
      dive_box(new WGroupBox("Dive", timeout_dive_thrust_cont)),
      dive_button_cont(new WContainerWidget(dive_box)),
      dive_button(new WPushButton("Dive", dive_button_cont)),
      dive_slider_cont(new WContainerWidget(dive_box)),
      dive_slider(new WSlider(Horizontal, dive_slider_cont)),
      dive_text_cont(new WContainerWidget(dive_box)),
      dive_text(new WText(dive_text_from_value(dive_slider->value()), dive_text_cont)),
      fins_box(new WGroupBox("Fins", low_level_box)),
      port_elevator_slider(new WSlider(Vertical, fins_box)),
      rudder_left_text(new WText(cfg.rudder_bounds().min_label(), fins_box)),
      rudder_slider(new WSlider(Horizontal, fins_box)),
      rudder_right_text(new WText(cfg.rudder_bounds().max_label(), fins_box)),
      stbd_elevator_slider(new WSlider(Vertical, fins_box)),
      fins_text_cont(new WContainerWidget(fins_box)),
      fins_text(
          new WText(fins_text_from_value(port_elevator_slider->value(),
                                         stbd_elevator_slider->value(), rudder_slider->value()),
                    fins_box)),
      pid_box(new WGroupBox("PID Controls", vehicle_cont)),
      pid_course_box(new WGroupBox("Course", pid_box)),
      pid_course_slider(new WSlider(Horizontal, pid_course_box)),
      pid_course_kp_slider(new WSlider(Vertical, pid_course_box)),
      pid_course_ki_slider(new WSlider(Vertical, pid_course_box)),
      pid_course_kd_slider(new WSlider(Vertical, pid_course_box)),
      pid_course_text_cont(new WContainerWidget(pid_course_box)),
      pid_course_text(
          new WText(pid_course_text_from_value(pid_course_slider->value()), pid_course_text_cont)),
      ack_box(new WGroupBox("Ack", low_level_box)),
      ack_text(new WText("No acks received", ack_box)),
      command_mode(new CommandMode{CommandMode::low_level_command})
{
    // formatting
    timeout_box->setInline(true);
    thrust_box->setInline(true);
    dive_box->setInline(true);
    fins_box->setInline(true);
    pid_box->setInline(true);
    button_group->addButton(button_low_level, 0);
    button_group->addButton(button_pid, 1);
    button_group->setSelectedButtonIndex(0);

    ack_text->setText("Testing");
    button_group->checkedChanged().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::button_changed, _1, button_group,
                    low_level_box, pid_box, command_mode, ack_text));

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

    thrust_slider->setMinimum(0);
    thrust_slider->setMaximum(cfg.motor_bounds().max());
    thrust_slider->setTickInterval((cfg.motor_bounds().max() - 0) / cfg.motor_bounds().n_ticks());
    thrust_slider->setTickPosition(Wt::WSlider::TicksBelow);
    thrust_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::thrust_slider_moved, _1, thrust_text));

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

    pid_course_slider->setMinimum(cfg.pid_course_bounds().min());
    pid_course_slider->setMaximum(cfg.pid_course_bounds().max());
    pid_course_slider->setTickInterval((cfg.pid_course_bounds().max() - 0) /
                                       cfg.pid_course_bounds().n_ticks());
    pid_course_slider->setTickPosition(Wt::WSlider::TicksBelow);
    pid_course_slider->sliderMoved().connect(boost::bind(
        &LiaisonJaiabot::VehicleData::Controls::pid_course_slider_moved, _1, pid_course_text));
}

void jaiabot::LiaisonJaiabot::key_press(WKeyEvent key)
{
    glog.is_debug1() && glog << "Key pressed: " << key.key() << std::endl;
    auto it = vehicle_data_.find(current_vehicle_);
    auto& vehicle_data = it->second;
    auto& controls = vehicle_data.controls;
    if (it != vehicle_data_.end())
    {
        auto& control = controls;
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
            case Key_R: // thrust +
                if (motor_go_)
                {
                    control.set_thrust_value(control.thrust_slider->value() +
                                             cfg_.motor_bounds().step());
                }
                break;
            case Key_W: // thrust -
                if (motor_go_)
                {
                    control.set_thrust_value(control.thrust_slider->value() -
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
            case Key_P: // course +
                control.set_pid_course_value(control.pid_course_slider->value() +
                                             cfg_.pid_course_bounds().step());
                break;
            case Key_O: // course -
                control.set_pid_course_value(control.pid_course_slider->value() -
                                             cfg_.pid_course_bounds().step());

                break;
            case Key_C: // reset all except timeout and PIDs
                // control.set_timeout_value(cfg_.timeout_bounds().center());
                control.set_thrust_value(cfg_.motor_bounds().center());
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
    auto& vehicle_data = it->second;
    auto& controls = vehicle_data.controls;
    if (it != vehicle_data_.end())
    {
        auto& control = controls;
        switch (key.key())
        {
            default: break;
            case Key_Shift: // dead man switch
                control.set_thrust_value(0);
                motor_go_ = false;
                break;
        }
    }
}
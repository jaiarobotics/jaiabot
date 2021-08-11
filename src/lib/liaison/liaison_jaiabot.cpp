#include <Wt/WComboBox>
#include <Wt/WContainerWidget>
#include <Wt/WGroupBox>
#include <Wt/WLabel>
#include <Wt/WPanel>
#include <Wt/WSlider>
#include <Wt/WStackedWidget>

#include "liaison_jaiabot.h"

const std::string STRIPE_ODD_CLASS = "odd";
const std::string STRIPE_EVEN_CLASS = "even";

using namespace goby::util::logger;
using goby::glog;

using namespace Wt;

jaiabot::LiaisonJaiabot::LiaisonJaiabot(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                                        Wt::WContainerWidget* parent)
    : goby::zeromq::LiaisonContainerWithComms<LiaisonJaiabot, CommsThread>(cfg),
      cfg_(cfg.GetExtension(protobuf::jaiabot_config))
{
    WPanel* vehicle_panel = new Wt::WPanel(this);
    vehicle_panel->setTitle("Bot");
    vehicle_panel->setCollapsible(true);
    vehicle_panel->setCollapsed(cfg_.minimize_vehicle());

    wApp->globalKeyWentDown().connect(boost::bind(&LiaisonJaiabot::key_press, this, _1));
    this->keyWentDown().connect(boost::bind(&LiaisonJaiabot::key_press, this, _1));

    WContainerWidget* vehicle_box = new Wt::WContainerWidget();
    vehicle_panel->setCentralWidget(vehicle_box);
    new WLabel("Bot: ", vehicle_box);
    vehicle_combo_ = new WComboBox(vehicle_box);
    vehicle_combo_->addItem("(Choose a vehicle)");
    vehicle_combo_->sactivated().connect(this, &LiaisonJaiabot::vehicle_select);

    vehicle_stack_ = new Wt::WStackedWidget(vehicle_box);
    vehicle_stack_->hide();

    const auto update_freq = 10.0;
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
        jaiabot::protobuf::ControlCommand cmd_msg;

        auto& cmd = *cmd_msg.mutable_command();

        static std::atomic<int> id(0);

        cmd_msg.set_id(id++);
        cmd_msg.set_vehicle(current_vehicle_);
        cmd_msg.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        cmd.set_motor(it->second.low_level_control.motor_slider->value());
        cmd.set_port_elevator(it->second.low_level_control.port_elevator_slider->value());
        cmd.set_stbd_elevator(it->second.low_level_control.stbd_elevator_slider->value());
        cmd.set_rudder(it->second.low_level_control.rudder_slider->value());

        glog.is_debug1() && glog << cmd_msg.ShortDebugString() << std::endl;

        this->post_to_comms(
            [=]() { goby_thread()->interprocess().publish<groups::control_command>(cmd_msg); });

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

void jaiabot::LiaisonJaiabot::post_control_ack(const protobuf::ControlAck& ack)
{
    glog.is_debug1() && glog << ack.ShortDebugString() << std::endl;
    auto it = vehicle_data_.find(ack.vehicle());
    if (it != vehicle_data_.end())
    {
        it->second.low_level_control.latest_ack = ack;
    }
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
    : controls_box(new WGroupBox("Low Level Controls ('R' resets to center values)", vehicle_div)),
      motor_box(new WGroupBox("Motor", controls_box)),
      fins_box(new WGroupBox("Fins", controls_box)),
      motor_slider(new WSlider(Horizontal, motor_box)),
      motor_text_box(new WContainerWidget(motor_box)),
      motor_text(new WText(motor_text_from_value(motor_slider->value()), motor_text_box)),
      port_elevator_slider(new WSlider(Vertical, fins_box)),
      rudder_slider(new WSlider(Horizontal, fins_box)),
      stbd_elevator_slider(new WSlider(Vertical, fins_box)),
      fins_text_box(new WContainerWidget(fins_box)),
      fins_text(
          new WText(fins_text_from_value(port_elevator_slider->value(),
                                         stbd_elevator_slider->value(), rudder_slider->value()),
                    fins_box)),
      ack_box(new WGroupBox("Ack", controls_box)),
      ack_text(new WText("No acks received", ack_box))

{
    motor_slider->setMinimum(cfg.motor_bounds().min());
    motor_slider->setMaximum(cfg.motor_bounds().max());
    motor_slider->setTickInterval((cfg.motor_bounds().max() - cfg.motor_bounds().min()) /
                                  cfg.motor_bounds().n_ticks());
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
            case Key_T: // port elevator +
                control.set_port_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                break;
            case Key_G: // port elevator -
                control.set_port_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;
            case Key_Y: // stbd elevator +
                control.set_stbd_elevator_value(control.stbd_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                break;
            case Key_H: // stbd elevator -
                control.set_stbd_elevator_value(control.stbd_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                break;

            case Key_W: // elevator +
                control.set_port_elevator_value(control.port_elevator_slider->value() +
                                                cfg_.elevator_bounds().step());
                control.set_stbd_elevator_value(control.port_elevator_slider->value());

                break;
            case Key_S: // elevator -
                control.set_port_elevator_value(control.port_elevator_slider->value() -
                                                cfg_.elevator_bounds().step());
                control.set_stbd_elevator_value(control.port_elevator_slider->value());
                break;
            case Key_D: // rudder +
                control.set_rudder_value(control.rudder_slider->value() +
                                         cfg_.rudder_bounds().step());

                break;
            case Key_A: // rudder -
                control.set_rudder_value(control.rudder_slider->value() -
                                         cfg_.rudder_bounds().step());

                break;
            case Key_E: // motor +
                control.set_motor_value(control.motor_slider->value() + cfg_.motor_bounds().step());

                break;
            case Key_Q: // motor -
                control.set_motor_value(control.motor_slider->value() - cfg_.motor_bounds().step());

                break;
            case Key_R:     // reset all
            case Key_Space: // reset all
                control.set_motor_value(cfg_.motor_bounds().center());
                control.set_rudder_value(cfg_.rudder_bounds().center());
                control.set_port_elevator_value(cfg_.elevator_bounds().center());
                control.set_stbd_elevator_value(cfg_.elevator_bounds().center());
                break;
        }
    }
}

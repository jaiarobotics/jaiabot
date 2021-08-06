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

    WContainerWidget* vehicle_box = new Wt::WContainerWidget();
    vehicle_panel->setCentralWidget(vehicle_box);
    new WLabel("Bot: ", vehicle_box);
    vehicle_combo_ = new WComboBox(vehicle_box);
    vehicle_combo_->addItem("(Choose a vehicle)");
    vehicle_combo_->sactivated().connect(this, &LiaisonJaiabot::vehicle_select);

    vehicle_stack_ = new Wt::WStackedWidget(vehicle_box);
    vehicle_stack_->hide();

    const auto update_freq = 10;
    timer_.setInterval(1 / (update_freq * 1.0e3));
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
    }
    else
    {
        vehicle_stack_->hide();
    }
}

void jaiabot::LiaisonJaiabot::loop()
{
    auto it = vehicle_data_.find(vehicle_stack_->currentIndex());
    if (it != vehicle_data_.end())
    {
        std::cout << "M: " << it->second.low_level_control.motor_value
                  << ",R:" << it->second.low_level_control.rudder_value
                  << ",E:" << it->second.low_level_control.elevator_value << std::endl;
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
    : controls_box(new WGroupBox("Low Level Controls", vehicle_div)),
      motor_box(new WGroupBox("Motor", controls_box)),
      fins_box(new WGroupBox("Fins", controls_box)),
      motor_slider(new WSlider(Horizontal, motor_box)),
      motor_text(new WText(motor_text_from_value(motor_slider->value()), motor_box)),
      elevator_slider(new WSlider(Vertical, fins_box)),
      rudder_slider(new WSlider(Horizontal, fins_box)),
      fins_text(new WText(fins_text_from_value(elevator_slider->value(), rudder_slider->value()),
                          fins_box))
{
    motor_slider->setMinimum(cfg.motor_bounds().min());
    motor_slider->setMaximum(cfg.motor_bounds().max());
    motor_slider->setTickInterval((cfg.motor_bounds().max() - cfg.motor_bounds().min()) /
                                  cfg.motor_bounds().n_ticks());
    motor_slider->setTickPosition(Wt::WSlider::TicksBelow);
    motor_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::motor_slider_moved, _1, motor_text));
    motor_slider->valueChanged().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::update_value, _1, &motor_value));

    elevator_slider->setMinimum(cfg.elevator_bounds().min());
    elevator_slider->setMaximum(cfg.elevator_bounds().max());
    elevator_slider->setTickInterval((cfg.elevator_bounds().max() - cfg.elevator_bounds().min()) /
                                     cfg.elevator_bounds().n_ticks());
    elevator_slider->setTickPosition(Wt::WSlider::TicksRight);
    elevator_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::elevator_slider_moved, _1, fins_text,
                    rudder_slider));
    elevator_slider->valueChanged().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::update_value, _1, &elevator_value));

    rudder_slider->setMinimum(cfg.rudder_bounds().min());
    rudder_slider->setMaximum(cfg.rudder_bounds().max());
    rudder_slider->setTickInterval((cfg.rudder_bounds().max() - cfg.rudder_bounds().min()) /
                                   cfg.rudder_bounds().n_ticks());
    rudder_slider->setTickPosition(Wt::WSlider::TicksBelow);
    rudder_slider->sliderMoved().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::rudder_slider_moved, _1, fins_text,
                    elevator_slider));
    rudder_slider->valueChanged().connect(
        boost::bind(&LiaisonJaiabot::VehicleData::Controls::update_value, _1, &rudder_value));
}

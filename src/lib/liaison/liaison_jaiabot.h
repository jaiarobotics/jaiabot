#ifndef LIAISON_JAIABOT_H
#define LIAISON_JAIABOT_H

#include <Wt/WEvent>
#include <Wt/WSlider>
#include <boost/thread/mutex.hpp>

#include "goby/zeromq/liaison/liaison_container.h"

#include "jaiabot/groups.h"
#include "jaiabot/messages/low_control.pb.h"

#include "config.pb.h"

namespace jaiabot
{
class CommsThread;

class LiaisonJaiabot : public goby::zeromq::LiaisonContainerWithComms<LiaisonJaiabot, CommsThread>
{
  public:
    LiaisonJaiabot(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                   Wt::WContainerWidget* parent = 0);

    void post_control_ack(const protobuf::ControlAck& ack);

  private:
    void loop();
    void focus() override { timer_.start(); }
    void unfocus() override { timer_.stop(); }

    void vehicle_select(Wt::WString msg);
    void check_add_vehicle(int vehicle_id);
    void key_press(Wt::WKeyEvent key);

  private:
    Wt::WComboBox* vehicle_combo_;
    Wt::WStackedWidget* vehicle_stack_;

    struct VehicleData
    {
        VehicleData(Wt::WStackedWidget*, const protobuf::JaiabotConfig&);

        Wt::WContainerWidget* vehicle_div;

        struct Controls
        {
            Controls(Wt::WContainerWidget* vehicle_div, const protobuf::JaiabotConfig& cfg);

            Wt::WGroupBox* controls_box;
            Wt::WGroupBox* motor_box;
            Wt::WGroupBox* fins_box;
            Wt::WSlider* motor_slider;
            Wt::WContainerWidget* motor_text_box;
            Wt::WText* motor_text{0};
            Wt::WSlider* port_elevator_slider;
            Wt::WSlider* rudder_slider;
            Wt::WSlider* stbd_elevator_slider;
            Wt::WContainerWidget* fins_text_box;
            Wt::WText* fins_text{0};

            // must be static, not sure why (segfault in JSignal otherwise)
            static void motor_slider_moved(int value, Wt::WText* text)
            {
                text->setText(motor_text_from_value(value));
            }

            static void port_elevator_slider_moved(int value, Wt::WText* text,
                                                   Wt::WSlider* stbd_elevator, Wt::WSlider* rudder)
            {
                text->setText(fins_text_from_value(value, stbd_elevator->value(), rudder->value()));
            }

            static void stbd_elevator_slider_moved(int value, Wt::WText* text,
                                                   Wt::WSlider* port_elevator, Wt::WSlider* rudder)
            {
                text->setText(fins_text_from_value(port_elevator->value(), value, rudder->value()));
            }
            static void rudder_slider_moved(int value, Wt::WText* text, Wt::WSlider* port_elevator,
                                            Wt::WSlider* stbd_elevator)
            {
                text->setText(
                    fins_text_from_value(port_elevator->value(), stbd_elevator->value(), value));
            }

            void set_port_elevator_value(int value)
            {
                port_elevator_slider->setValue(value);
                fins_text->setText(fins_text_from_value(port_elevator_slider->value(),
                                                        stbd_elevator_slider->value(),
                                                        rudder_slider->value()));
            }

            void set_stbd_elevator_value(int value)
            {
                stbd_elevator_slider->setValue(value);
                fins_text->setText(fins_text_from_value(port_elevator_slider->value(),
                                                        stbd_elevator_slider->value(),
                                                        rudder_slider->value()));
            }

            void set_rudder_value(int value)
            {
                rudder_slider->setValue(value);
                fins_text->setText(fins_text_from_value(port_elevator_slider->value(),
                                                        stbd_elevator_slider->value(),
                                                        rudder_slider->value()));
            }

            void set_motor_value(int value)
            {
                motor_slider->setValue(value);
                motor_text->setText(motor_text_from_value(motor_slider->value()));
            }
        };

        Controls low_level_control;

        int index_in_stack{0};

        static std::string motor_text_from_value(int value)
        {
            return "Motor (Q-/E+): " + std::to_string(value);
        }
        static std::string fins_text_from_value(int port_elevator_value, int stbd_elevator_value,
                                                int rudder_value)
        {
            return "Port Elevator (G-/T+ or S-/W+ for both): " +
                   std::to_string(port_elevator_value) +
                   "<br/>Starboard Elevator (H-/Y+ or S-/W+ for both): " +
                   std::to_string(stbd_elevator_value) +
                   "<br/>Rudder (A-/D+): " + std::to_string(rudder_value);
        }
    };

    // vehicle id to Data
    std::map<int, VehicleData> vehicle_data_;

    // currently shown vehicle id
    int current_vehicle_{-1};

    Wt::WTimer timer_;
    friend class CommsThread;
    const protobuf::JaiabotConfig& cfg_;
};

class CommsThread : public goby::zeromq::LiaisonCommsThread<LiaisonJaiabot>
{
  public:
    CommsThread(LiaisonJaiabot* tab, const goby::apps::zeromq::protobuf::LiaisonConfig& config,
                int index)
        : LiaisonCommsThread<LiaisonJaiabot>(tab, config, index), tab_(tab)
    {
        interprocess().subscribe<groups::control_ack>([this](const protobuf::ControlAck& ack) {
            tab_->post_to_wt([=]() { tab_->post_control_ack(ack); });
        });

    } // namespace jaiabot
    ~CommsThread() {}

  private:
    friend class LiaisonJaiabot;
    LiaisonJaiabot* tab_;
};

} // namespace jaiabot

#endif

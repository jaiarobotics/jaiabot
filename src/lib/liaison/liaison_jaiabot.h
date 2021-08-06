#ifndef LIAISON_JAIABOT_H
#define LIAISON_JAIABOT_H

#include <Wt/WSlider>
#include <boost/thread/mutex.hpp>

#include "goby/zeromq/liaison/liaison_container.h"

#include "jaiabot/groups.h"

#include "config.pb.h"

namespace jaiabot
{
class CommsThread;

class LiaisonJaiabot : public goby::zeromq::LiaisonContainerWithComms<LiaisonJaiabot, CommsThread>
{
  public:
    LiaisonJaiabot(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                   Wt::WContainerWidget* parent = 0);

  private:
    void loop();
    void focus() override { timer_.start(); }
    void unfocus() override { timer_.stop(); }

    void vehicle_select(Wt::WString msg);
    void check_add_vehicle(int vehicle_id);

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
            Wt::WText* motor_text{0};
            Wt::WSlider* elevator_slider;
            Wt::WSlider* rudder_slider;
            Wt::WText* fins_text{0};

            int motor_value{0};
            int rudder_value{0};
            int elevator_value{0};

            static void update_value(int v, int* value) { *value = v; }

            // must be static, not sure why (segfault in JSignal otherwise)
            static void motor_slider_moved(int value, Wt::WText* text)
            {
                text->setText(motor_text_from_value(value));
            }

            static void elevator_slider_moved(int value, Wt::WText* text, Wt::WSlider* rudder)
            {
                text->setText(fins_text_from_value(value, rudder->value()));
            }

            static void rudder_slider_moved(int value, Wt::WText* text, Wt::WSlider* elevator)
            {
                text->setText(fins_text_from_value(elevator->value(), value));
            }
        };

        Controls low_level_control;

        int index_in_stack{0};

        static std::string motor_text_from_value(int value)
        {
            return "Motor: " + std::to_string(value);
        }
        static std::string fins_text_from_value(int elevator_value, int rudder_value)
        {
            return "Elevator: " + std::to_string(elevator_value) +
                   ", Rudder: " + std::to_string(rudder_value);
        }
    };

    // vehicle id to Data
    std::map<int, VehicleData> vehicle_data_;

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
    } // namespace jaiabot
    ~CommsThread() {}

  private:
    friend class LiaisonJaiabot;
    LiaisonJaiabot* tab_;
};

} // namespace jaiabot

#endif

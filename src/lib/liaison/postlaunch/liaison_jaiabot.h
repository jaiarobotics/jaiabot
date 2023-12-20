#ifndef LIAISON_JAIABOT_H
#define LIAISON_JAIABOT_H

#include <Wt/WEvent>
#include <Wt/WPushButton>
#include <Wt/WSlider>
#include <boost/thread/mutex.hpp>
#include <boost/units/io.hpp>
#include <chrono>

#include "goby/zeromq/liaison/liaison_container.h"
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/low_control.pb.h"
#include "jaiabot/messages/salinity.pb.h"

#include "config.pb.h"
#include "jaiabot/messages/pressure_temperature.pb.h"

namespace jaiabot
{
class CommsThread;

class LiaisonJaiabot : public goby::zeromq::LiaisonContainerWithComms<LiaisonJaiabot, CommsThread>
{
  public:
    LiaisonJaiabot(const goby::apps::zeromq::protobuf::LiaisonConfig& cfg,
                   Wt::WContainerWidget* parent = 0);

    void post_control_ack(const protobuf::LowControlAck& ack);
    void post_node_status(const goby::middleware::frontseat::protobuf::NodeStatus& node_status);
    void post_tpv(const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv);
    void post_pt(const jaiabot::protobuf::PressureTemperatureData& pt);
    void post_salinity(const jaiabot::protobuf::SalinityData& salinity);
    void post_imu(const jaiabot::protobuf::IMUData& imu);
    void post_low_control(const jaiabot::protobuf::LowControl& low_control);

  private:
    void loop();
    void focus() override { timer_.start(); }
    void unfocus() override { timer_.stop(); }

    void vehicle_select(Wt::WString msg);
    void check_add_vehicle(int node_id);
    void key_press(Wt::WKeyEvent key);
    void key_release(Wt::WKeyEvent key);

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
            Wt::WGroupBox* timeout_box;
            Wt::WSlider* timeout_slider;
            Wt::WContainerWidget* timeout_text_box;
            Wt::WText* timeout_text{0};
            Wt::WGroupBox* dive_box;
            Wt::WContainerWidget* dive_button_box;
            Wt::WPushButton* dive_button{0};
            Wt::WContainerWidget* dive_slider_box;
            Wt::WSlider* dive_slider;
            Wt::WContainerWidget* dive_text_box;
            Wt::WText* dive_text{0};
            Wt::WGroupBox* motor_box;
            Wt::WText* motor_left_text{0};
            Wt::WSlider* motor_slider;
            Wt::WText* motor_right_text{0};
            Wt::WContainerWidget* motor_text_box;
            Wt::WText* motor_text{0};
            Wt::WGroupBox* fins_box;
            Wt::WSlider* port_elevator_slider;
            Wt::WText* rudder_left_text{0};
            Wt::WSlider* rudder_slider;
            Wt::WText* rudder_right_text{0};
            Wt::WSlider* stbd_elevator_slider;
            Wt::WContainerWidget* fins_text_box;
            Wt::WText* fins_text{0};
            Wt::WGroupBox* ack_box;
            Wt::WText* ack_text{0};
            Wt::WGroupBox* data_box;
            Wt::WText* data_text{0};

            protobuf::LowControlAck latest_ack;

            // must be static, not sure why (segfault in JSignal otherwise)
            static void timeout_slider_moved(int value, Wt::WText* text)
            {
                text->setText(timeout_text_from_value(value));
            }

            static void dive_slider_moved(int value, Wt::WText* text)
            {
                text->setText(dive_text_from_value(value));
            }

            static void dive_button_clicked(Wt::WMouseEvent) { dive_start_ = true; }

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

            void set_timeout_value(int value)
            {
                timeout_slider->setValue(value);
                timeout_text->setText(timeout_text_from_value(timeout_slider->value()));
            }

            void set_dive_value(int value)
            {
                dive_slider->setValue(value);
                dive_text->setText(dive_text_from_value(dive_slider->value()));
            }
        };

        Controls low_level_control;

        int index_in_stack{0};

        static std::string timeout_text_from_value(int value)
        {
            return "Timeout (X-/V+): " + std::to_string(value);
        }

        static std::string dive_text_from_value(int value)
        {
            return "Dive (Y-/U+): " + std::to_string(value);
        }

        static std::string motor_text_from_value(int value)
        {
            return "Motor (W-/R+): " + std::to_string(value);
        }
        static std::string fins_text_from_value(int port_elevator_value, int stbd_elevator_value,
                                                int rudder_value)
        {
            return "Port Elevator (A-/Q+ or D-/E+ for both): " +
                   std::to_string(port_elevator_value) +
                   "<br/>Starboard Elevator (G-/T+ or D-/E+ for both): " +
                   std::to_string(stbd_elevator_value) +
                   "<br/>Rudder (S-/F+): " + std::to_string(rudder_value);
        }
    };

    // vehicle id to Data
    std::map<int, VehicleData> vehicle_data_;

    // convenient info shown on vehicle's liaison
    Wt::WGroupBox* bot_node_status_box_;
    Wt::WText* bot_node_status_text_;
    Wt::WGroupBox* bot_tpv_box_;
    Wt::WText* bot_tpv_text_;
    Wt::WGroupBox* bot_pt_box_;
    Wt::WText* bot_pt_text_;
    Wt::WGroupBox* bot_salinity_box_;
    Wt::WText* bot_salinity_text_;
    Wt::WGroupBox* bot_imu_box_;
    Wt::WText* bot_imu_text_;
    Wt::WGroupBox* bot_low_control_box_;
    Wt::WText* bot_low_control_text_;

    // currently shown vehicle id
    int current_vehicle_{-1};

    bool motor_go_{false};
    static bool dive_start_;
    static std::chrono::system_clock::time_point dive_expire_;

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
        interprocess().subscribe<groups::control_ack>([this](const protobuf::LowControlAck& ack) {
            tab_->post_to_wt([=]() { tab_->post_control_ack(ack); });
        });

        // post the NodeStatus message in its own box
        interprocess().subscribe<goby::middleware::frontseat::groups::node_status>(
            [this](const goby::middleware::frontseat::protobuf::NodeStatus& node_status) {
                tab_->post_to_wt([=]() { tab_->post_node_status(node_status); });
            });

        // post the tpv in its own box
        interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
            [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {
                tab_->post_to_wt([=]() { tab_->post_tpv(tpv); });
            });

        // post the pt data in its own box
        interprocess().subscribe<groups::pressure_temperature>(
            [this](const jaiabot::protobuf::PressureTemperatureData& pt) {
                tab_->post_to_wt([=]() { tab_->post_pt(pt); });
            });

        // post the salinity data in its own box
        interprocess().subscribe<groups::salinity>(
            [this](const jaiabot::protobuf::SalinityData& salinity) {
                tab_->post_to_wt([=]() { tab_->post_salinity(salinity); });
            });

        // post the imu data in its own box
        interprocess().subscribe<groups::imu>([this](const jaiabot::protobuf::IMUData& imu) {
            tab_->post_to_wt([=]() { tab_->post_imu(imu); });
        });

        // post the control surfaces data in its own box
        interprocess().subscribe<groups::low_control>(
            [this](const jaiabot::protobuf::LowControl& low_control) {
                tab_->post_to_wt([=]() { tab_->post_low_control(low_control); });
            });

    } // namespace jaiabot
    ~CommsThread() {}

  private:
    friend class LiaisonJaiabot;
    LiaisonJaiabot* tab_;
};

} // namespace jaiabot

#endif

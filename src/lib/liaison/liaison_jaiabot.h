#ifndef LIAISON_JAIABOT_H
#define LIAISON_JAIABOT_H

#include <Wt/WButtonGroup>
#include <Wt/WComboBox>
#include <Wt/WContainerWidget>
#include <Wt/WEvent>
#include <Wt/WGroupBox>
#include <Wt/WLabel>
#include <Wt/WPanel>
#include <Wt/WPushButton>
#include <Wt/WRadioButton>
#include <Wt/WSlider>
#include <Wt/WStackedWidget>
#include <boost/thread/mutex.hpp>
#include <chrono>

#include "goby/zeromq/liaison/liaison_container.h"
#include <goby/middleware/frontseat/groups.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/frontseat_data.pb.h>
#include <goby/middleware/protobuf/gpsd.pb.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/imu.pb.h"
#include "jaiabot/messages/pt.pb.h"
#include "jaiabot/messages/salinity.pb.h"
#include "jaiabot/messages/vehicle_command.pb.h"

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
    void post_node_status(const goby::middleware::frontseat::protobuf::NodeStatus& node_status);
    void post_tpv(const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv);
    void post_pt(const jaiabot::protobuf::PTData& pt);
    void post_salinity(const jaiabot::protobuf::SalinityData& salinity);
    void post_imu(const jaiabot::protobuf::IMUData& imu);
    void post_vehicle_command(const jaiabot::protobuf::VehicleCommand& vehicle_command);

  private:
    void loop();
    void focus() override { timer_.start(); }
    void unfocus() override { timer_.stop(); }

    void vehicle_select(Wt::WString msg);
    void check_add_vehicle(int vehicle_id);
    void key_press(Wt::WKeyEvent key);
    void key_release(Wt::WKeyEvent key);

  private:
    Wt::WComboBox* vehicle_combo_;
    Wt::WStackedWidget* vehicle_stack_;

    struct VehicleData
    {
        VehicleData(Wt::WStackedWidget*, const protobuf::JaiabotConfig&);

        Wt::WContainerWidget* vehicle_cont;

        struct Controls
        {
            Controls(Wt::WContainerWidget* vehicle_cont, const protobuf::JaiabotConfig& cfg);

            // Button Group
            Wt::WGroupBox* button_box;
            Wt::WButtonGroup* button_group;
            Wt::WRadioButton* button_low_level;
            Wt::WRadioButton* button_pid;
            Wt::WRadioButton* button_dive;
            // Low Level
            Wt::WGroupBox* low_level_box;
            // --Timeout, Thrust, and Dive
            Wt::WContainerWidget* timeout_dive_thrust_cont;
            // --==Timeout
            Wt::WGroupBox* timeout_box;
            Wt::WSlider* timeout_slider;
            Wt::WContainerWidget* timeout_text_cont;
            Wt::WText* timeout_text{0};
            // --==Thrust
            Wt::WGroupBox* thrust_box;
            Wt::WText* thrust_left_text{0};
            Wt::WSlider* thrust_slider;
            Wt::WText* thrust_right_text{0};
            Wt::WContainerWidget* thrust_text_cont;
            Wt::WText* thrust_text{0};
            // --==Dive
            Wt::WGroupBox* dive_box;
            Wt::WContainerWidget* dive_button_cont;
            Wt::WPushButton* dive_button{0};
            Wt::WContainerWidget* dive_slider_cont;
            Wt::WSlider* dive_slider;
            Wt::WContainerWidget* dive_text_cont;
            Wt::WText* dive_text{0};
            // --Fins
            Wt::WGroupBox* fins_box;
            Wt::WSlider* port_elevator_slider;
            Wt::WText* rudder_left_text{0};
            Wt::WSlider* rudder_slider;
            Wt::WText* rudder_right_text{0};
            Wt::WSlider* stbd_elevator_slider;
            Wt::WContainerWidget* fins_text_cont;
            Wt::WText* fins_text{0};
            // --Ack
            Wt::WGroupBox* ack_box;
            Wt::WText* ack_text{0};
            Wt::WGroupBox* data_box;
            Wt::WText* data_text{0};
            // PID Controls
            Wt::WGroupBox* pid_box;
            // --PID Course
            Wt::WGroupBox* pid_course_box;
            Wt::WSlider* pid_course_slider;
            Wt::WSlider* pid_course_kp_slider;
            Wt::WSlider* pid_course_ki_slider;
            Wt::WSlider* pid_course_kd_slider;
            Wt::WContainerWidget* pid_course_text_cont;
            Wt::WText* pid_course_text{0};

            protobuf::ControlAck latest_ack;

            enum CommandMode
            {
                low_level_command,
                pid_command,
                dive_command
            };
            // I made this a pointer so I could connect it to a slot.
            CommandMode* command_mode;

            // must be static, not sure why (segfault in JSignal otherwise)
            static void timeout_slider_moved(int value, Wt::WText* text)
            {
                text->setText(timeout_text_from_value(value));
            }

            static void button_changed(Wt::WRadioButton* button, Wt::WButtonGroup* button_group,
                                       Wt::WGroupBox* low_level_box, Wt::WGroupBox* pid_box,
                                       CommandMode* command_mode, Wt::WText* text)
            {
                text->setText("So stupid, so dumb.");
                switch (button_group->checkedId())
                {
                    case 0:
                        text->setText("Zero");
                        low_level_box->show();
                        pid_box->hide();
                        *command_mode = low_level_command;
                        break;
                    case 1:
                        text->setText("One");
                        low_level_box->hide();
                        pid_box->show();
                        *command_mode = pid_command;
                        break;
                    case 2:
                        // Stub for Dive mode
                        break;
                    default:
                        text->setText("FUBAR");
                        low_level_box->hide();
                        pid_box->hide();
                }
            }

            static void dive_slider_moved(int value, Wt::WText* text)
            {
                text->setText(dive_text_from_value(value));
            }

            static void dive_button_clicked(Wt::WMouseEvent) { dive_start_ = true; }

            static void thrust_slider_moved(int value, Wt::WText* text)
            {
                text->setText(thrust_text_from_value(value));
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

            static void pid_course_slider_moved(int value, Wt::WText* text)
            {
                text->setText(pid_course_text_from_value(value));
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

            void set_thrust_value(int value)
            {
                thrust_slider->setValue(value);
                thrust_text->setText(thrust_text_from_value(thrust_slider->value()));
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

            void set_pid_course_value(int value)
            {
                pid_course_slider->setValue(value);
                pid_course_text->setText(pid_course_text_from_value(pid_course_slider->value()));
            }
        };

        Controls controls;

        int index_in_stack{0};

        static std::string timeout_text_from_value(int value)
        {
            return "Timeout (X-/V+): " + std::to_string(value);
        }

        static std::string dive_text_from_value(int value)
        {
            return "Dive (Y-/U+): " + std::to_string(value);
        }

        static std::string thrust_text_from_value(int value)
        {
            return "Thrust (W-/R+): " + std::to_string(value);
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

        static std::string pid_course_text_from_value(int value)
        {
            return "PID Rudder Course (O-/P+): " + std::to_string(value);
        }
    };

    // vehicle id to Data
    std::map<int, VehicleData> vehicle_data_;

    // Top-most container
    Wt::WContainerWidget* bot_top_cont_;
    // --Vehicle Command
    Wt::WGroupBox* bot_vehicle_command_box_;
    Wt::WText* bot_vehicle_command_text_;
    // --Node Status
    Wt::WGroupBox* bot_node_status_box_;
    Wt::WText* bot_node_status_text_;
    // --IMU
    Wt::WGroupBox* bot_imu_box_;
    Wt::WText* bot_imu_text_;
    // --Sensors
    Wt::WGroupBox* bot_sensor_box_;
    // --==Pressure & Temperature
    Wt::WGroupBox* bot_pt_box_;
    Wt::WText* bot_pt_text_;
    // --==Salinity
    Wt::WGroupBox* bot_salinity_box_;
    Wt::WText* bot_salinity_text_;
    // --TPV
    Wt::WGroupBox* bot_tpv_box_;
    Wt::WText* bot_tpv_text_;

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
        interprocess().subscribe<groups::control_ack>([this](const protobuf::ControlAck& ack) {
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
        interprocess().subscribe<groups::pt>([this](const jaiabot::protobuf::PTData& pt) {
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
        interprocess().subscribe<groups::vehicle_command>(
            [this](const jaiabot::protobuf::VehicleCommand& vehicle_command) {
                tab_->post_to_wt([=]() { tab_->post_vehicle_command(vehicle_command); });
            });

    } // namespace jaiabot
    ~CommsThread() {}

  private:
    friend class LiaisonJaiabot;
    LiaisonJaiabot* tab_;
};

} // namespace jaiabot

#endif

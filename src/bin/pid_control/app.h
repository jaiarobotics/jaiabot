#ifndef BOT_PID_CONTROL_H
#define BOT_PID_CONTROL_H

#include <atomic>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/engineering.pb.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/low_control.pb.h"

#include "PID/PID.h"

namespace jaiabot
{
namespace apps
{
class BotPidControl : public goby::zeromq::MultiThreadApplication<config::BotPidControl>
{
  public:
    BotPidControl();

  private:
    // Timeout
    goby::time::MicroTime timeout_{5 * boost::units::si::seconds};
    goby::time::MicroTime lastCommandReceived_{0 * boost::units::si::seconds};

    // Throttle
    enum ThrottleMode
    {
        MANUAL,
        PID_SPEED,
        PID_DEPTH
    };

    ThrottleMode _throttleMode_ = MANUAL;
    void setThrottleMode(const ThrottleMode newThrottleMode);

    float throttle_ = 0.0;

    float actual_speed_ = 0.0;
    float target_speed_ = 0.0;
    float full_speed_window_ = 1.0;
    float processed_target_speed_ = 0.0;
    Pid* throttle_speed_pid_;

    float actual_depth_ = 0.0;

    // target_depth_ is the setpoint actually fed to throttle_depth_pid_. Instead of jumping
    // straight to commanded_depth_ (the final depth we've been asked to reach), it moves
    // toward it gradually, at no more than max_depth_rate_ meters/second (see
    // update_depth_ramp()), so the PID is never handed a sudden, large change in target depth.
    float target_depth_ = 0.0;
    float commanded_depth_ = 0.0;
    float max_depth_rate_ = 1.0;
    goby::time::MicroTime last_depth_ramp_time_{0 * boost::units::si::seconds};

    void set_target_depth(const float new_commanded_depth)
    {
        setThrottleMode(PID_DEPTH);

        // If the commanded target has changed, reset the I term, so bot doesn't grind motor against seafloor.
        if (commanded_depth_ != new_commanded_depth)
        {
            throttle_depth_pid_->reset_iterm();
            commanded_depth_ = new_commanded_depth;
        }
    }

    // Advances target_depth_ toward commanded_depth_ at no more than max_depth_rate_.
    void update_depth_ramp();

    Pid* throttle_depth_pid_;

    bool use_throttle_table_for_speed_ = false;

    // maps speed to throttle value
    std::map<float, int> speed_to_throttle_;

    // Course targeting
    float target_heading_ = 0.0;
    float actual_heading_ = -1e10;
    float rudder_ = 0.0;
    bool _rudder_is_using_pid_ = false;
    bool is_heading_constant_ = false;
    void toggleRudderPid(const bool enabled, const bool is_heading_constant = false);
    Pid* heading_pid_;
    Pid* heading_constant_pid_;

    // Roll targeting
    float target_roll_ = 0.0;
    float actual_roll_ = 0.0;
    float elevator_delta_ = 0.0;
    float port_elevator_ = 0.0, stbd_elevator_ = 0.0;
    bool _elevator_is_using_pid_ = false;
    void toggleElevatorPid(const bool enabled);
    Pid* roll_pid_;

    // Pitch targeting
    float target_pitch_ = 0.0;
    float actual_pitch_ = 0.0;
    float elevator_middle_ = 0.0;
    Pid* pitch_pid_;

    jaiabot::protobuf::LowControl cmd_msg_;
    std::atomic<int> id_;

    jaiabot::protobuf::Bounds bounds_;

    // Arduino Response for motor in percent
    int arduino_motor_throttle_{0};

    // if true, don't send low control (used by mission_repeater)
    bool suspended_{false};

  private:
    void loop() override;

    void handle_command(const jaiabot::protobuf::DesiredSetpoints& command);
    void handle_helm_course(const jaiabot::protobuf::DesiredSetpoints& desired_course);
    void handle_remote_control(const jaiabot::protobuf::RemoteControl& remote_control);
    void handle_dive_depth(const jaiabot::protobuf::DesiredSetpoints& command);
    void handle_powered_ascent(const jaiabot::protobuf::DesiredSetpoints& command);

    void handle_engineering_command(const jaiabot::protobuf::PIDControl& pid_control);
    void publish_engineering_status();
    void publish_low_control();

    void all_stop();
};

} // namespace apps
} // namespace jaiabot

#endif

#ifndef BOT_PID_CONTROL_H
#define BOT_PID_CONTROL_H

#include <atomic>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/engineering.pb.h"
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
    goby::time::MicroTime timeout{5 * boost::units::si::seconds};
    goby::time::MicroTime lastCommandReceived{0 * boost::units::si::seconds};

    // Throttle
    enum ThrottleMode
    {
        MANUAL,
        PID_SPEED,
        PID_DEPTH
    };

    ThrottleMode _throttleMode = MANUAL;
    void setThrottleMode(const ThrottleMode newThrottleMode);

    float throttle = 0.0;

    float actual_speed = 0.0;
    float target_speed = 0.0;
    float full_speed_window = 1.0;
    float processed_target_speed = 0.0;
    Pid* throttle_speed_pid;

    float actual_depth = 0.0;
    float target_depth = 0.0;
    Pid* throttle_depth_pid;

    bool use_throttle_table_for_speed = false;

    // maps speed to throttle value
    std::map<float, int> speed_to_throttle_;

    // Course targeting
    float target_heading = 0.0;
    float actual_heading = -1e10;
    float rudder = 0.0;
    bool _rudder_is_using_pid = false;
    void toggleRudderPid(const bool enabled);
    Pid* heading_pid;

    // Roll targeting
    float target_roll = 0.0;
    float actual_roll = 0.0;
    float elevator_delta = 0.0;
    float port_elevator = 0.0, stbd_elevator = 0.0;
    bool _elevator_is_using_pid = false;
    void toggleElevatorPid(const bool enabled);
    Pid* roll_pid;

    // Pitch targeting
    float target_pitch = 0.0;
    float actual_pitch = 0.0;
    float elevator_middle = 0.0;
    Pid* pitch_pid;
    
    bool engineering_messages_enabled = false;
    jaiabot::protobuf::Engineering engineering_status;

    jaiabot::protobuf::LowControl cmd_msg;
    std::atomic<int> id;

    jaiabot::protobuf::Bounds bounds;

  private:
    void loop() override;

    void handle_command(const jaiabot::protobuf::DesiredSetpoints& command);
    void
    handle_helm_course(const goby::middleware::frontseat::protobuf::DesiredCourse& desired_course);
    void handle_remote_control(const jaiabot::protobuf::RemoteControl& remote_control);
    void handle_dive_depth(const jaiabot::protobuf::DesiredSetpoints& command);
    void handle_powered_ascent();

    void handle_engineering_command(const jaiabot::protobuf::PIDControl& pid_control);
    void publish_engineering_status();

    void all_stop();
};

} // namespace apps
} // namespace jaiabot

#endif

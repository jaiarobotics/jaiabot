#ifndef BOT_PID_CONTROL_H
#define BOT_PID_CONTROL_H

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/pid_control.pb.h"

#include "PID/PID.h"

using jaiabot::protobuf::rest::Command;
using jaiabot::protobuf::rest::CommandAck;

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
    int timeout = 5;

    // Throttle
    enum ThrottleMode {
      MANUAL, PID_SPEED, PID_DEPTH
    };

    ThrottleMode throttleMode = MANUAL;

    float throttle;

    float actual_speed = 0.0;
    float target_speed = 0.0;
    Pid *throttle_speed_pid;

    float actual_depth = 0.0;
    float target_depth = 0.0;
    Pid *throttle_depth_pid;

    // Course targeting
    float target_heading = 0.0;
    float actual_heading = 0.0;
    float rudder = 0.0;
    bool rudder_is_using_pid = false;
    Pid *course_pid;
    float heading_kp = 1, heading_ki = 1, heading_kd = 1;

    // Roll targeting
    float target_roll = 0.0;
    float actual_roll = 0.0;
    float elevator_delta = 0.0;
    float port_elevator, stbd_elevator;
    bool elevator_is_using_pid = false;
    Pid *roll_pid;
    float roll_kp = 1, roll_ki = 1, roll_kd = 1;

    // Pitch targeting
    float target_pitch = 0.0;
    float actual_pitch = 0.0;
    float elevator_middle = 0.0;
    Pid *pitch_pid;
    float pitch_kp = 1, pitch_ki = 1, pitch_kd = 1;

    void loop() override;

    void handle_command(const Command& command);

  private:
};

} // namespace apps
} // namespace jaiabot

#endif

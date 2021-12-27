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

    // Speed targeting
    float target_speed = 0.0;
    float actual_speed = 0.0;
    float throttle = 0.0;
    bool throttle_is_using_pid = false;
    Pid *speed_pid;
    float speed_kp = 1, speed_ki = 1, speed_kd = 1;

    // Course targeting
    float target_heading = 0.0;
    float actual_heading = 0.0;
    float rudder = 0.0;
    bool rudder_is_using_pid = false;
    Pid *course_pid;
    float heading_kp = 1, heading_ki = 1, heading_kd = 1;

    void loop() override;

    void handle_command(const Command& command);

  private:
};

} // namespace apps
} // namespace jaiabot

#endif

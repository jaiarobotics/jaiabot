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

namespace jaiabot
{
namespace apps
{
class BotPidControl : public goby::zeromq::MultiThreadApplication<config::BotPidControl>
{
  public:
    BotPidControl();

  private:
    float kp = 1, ki = 1, kd = 1;

    // Course targeting
    float target_heading = 0.0;
    float actual_heading = 0.0;
    float rudder = 0.0;
    bool rudder_is_using_pid = false;
    Pid *course_pid;

    void loop() override;

    void handle_command(const Command& command);

  private:
};

} // namespace apps
} // namespace jaiabot

#endif

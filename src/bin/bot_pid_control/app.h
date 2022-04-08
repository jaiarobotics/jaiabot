#ifndef BOT_PID_CONTROL_H
#define BOT_PID_CONTROL_H

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/pid_control.pb.h"

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

    ThrottleMode throttleMode = MANUAL;

    float throttle;

    float actual_speed = 0.0;
    float target_speed = 0.0;
    Pid* throttle_speed_pid;

    float actual_depth = 0.0;
    float target_depth = 0.0;
    Pid* throttle_depth_pid;

    // Course targeting
    float target_heading = 0.0;
    float actual_heading = 0.0;
    float rudder = 0.0;
    bool rudder_is_using_pid = false;
    Pid* heading_pid;
    float heading_kp = 1, heading_ki = 0, heading_kd = 0;

    // Roll targeting
    float target_roll = 0.0;
    float actual_roll = 0.0;
    float elevator_delta = 0.0;
    float port_elevator, stbd_elevator;
    bool elevator_is_using_pid = false;
    Pid* roll_pid;
    float roll_kp = 1, roll_ki = 0, roll_kd = 0;

    // Pitch targeting
    float target_pitch = 0.0;
    float actual_pitch = 0.0;
    float elevator_middle = 0.0;
    Pid* pitch_pid;
    float pitch_kp = 1, pitch_ki = 0, pitch_kd = 0;

  private:

    void loop() override;

    void handle_command(const jaiabot::protobuf::PIDCommand& command);

    void handle_command(const jaiabot::protobuf::DesiredSetpoints& command);
    void
    handle_helm_course(const goby::middleware::frontseat::protobuf::DesiredCourse& desired_course);
    void handle_remote_control(const jaiabot::protobuf::RemoteControl& remote_control);
    void handle_dive_depth(const double& dive_depth);
    void handle_powered_ascent();

};

} // namespace apps
} // namespace jaiabot

#endif

// Copyright 2024:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/zeromq/application/single_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/mission.pb.h"

using goby::glog;
namespace si = boost::units::si;
using ApplicationBase = goby::zeromq::SingleThreadApplication<jaiabot::config::MissionRepeater>;

namespace jaiabot
{
namespace apps
{
class MissionRepeater : public ApplicationBase
{
  public:
    MissionRepeater();

  private:
    struct ScriptStep
    {
        goby::time::SteadyClock::time_point next_time; // for repeat
        goby::time::SteadyClock::time_point end_time;
        config::MissionRepeater::Script::Step step;
    };

    void loop() override;
    void start_script();
    void run_script();
    void run_step(ScriptStep& step, bool is_repeat);
    void resume_mission();

  private:
    bool script_started_{false};
    bool script_running_{false};

    std::deque<ScriptStep> script_;
};
} // namespace apps
} // namespace jaiabot

int main(int argc, char* argv[])
{
    return goby::run<jaiabot::apps::MissionRepeater>(
        goby::middleware::ProtobufConfigurator<jaiabot::config::MissionRepeater>(argc, argv));
}

jaiabot::apps::MissionRepeater::MissionRepeater() : ApplicationBase(10 * boost::units::si::hertz)
{
    interprocess().subscribe<jaiabot::groups::mission_report>(
        [this](const protobuf::MissionReport& report)
        {
            // start script when mission just begins recovery
            if (!script_started_ &&
                report.state() == protobuf::IN_MISSION__UNDERWAY__RECOVERY__TRANSIT)
            {
                start_script();
            }

            // run script once mission is paused
            if (script_started_ && !script_running_ &&
                report.state() == protobuf::IN_MISSION__PAUSE__MANUAL)
            {
                run_script();
            }

            // if mission leaves paused while script is running, clear the script
            if (script_running_ && report.state() != protobuf::IN_MISSION__PAUSE__MANUAL)
            {
                glog.is_verbose() && glog << "Script interrupted, resuming mission" << std::endl;
                script_.clear();
            }

            if (report.state() == protobuf::IN_MISSION__UNDERWAY__REPLAN)
            {
                // reset so we can rerun the mission in water
                script_started_ = false;
                script_running_ = false;
                glog.is_verbose() && glog << "Reset script" << std::endl;
            }
        });
}

void jaiabot::apps::MissionRepeater::start_script()
{
    glog.is_verbose() && glog << "Start script" << std::endl;
    protobuf::Command command;
    command.set_bot_id(cfg().bot_id());
    command.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    command.set_type(protobuf::Command::PAUSE);
    interprocess().publish<jaiabot::groups::self_command>(command);

    script_started_ = true;
}

void jaiabot::apps::MissionRepeater::run_script()
{
    script_.clear();
    auto now = goby::time::SteadyClock::now();
    auto start_time = now;
    for (const auto& step : cfg().script().step())
    {
        auto next_time = start_time; // gets updated by run_step()
        auto end_time =
            start_time + goby::time::convert_duration<goby::time::SteadyClock::duration>(
                             step.duration_with_units());

        script_.push_back(ScriptStep({next_time, end_time, step}));
        start_time = end_time;
    }
    run_step(script_.front(), false);
    script_running_ = true;
}

void jaiabot::apps::MissionRepeater::loop()
{
    auto now = goby::time::SteadyClock::now();
    if (!script_.empty())
    {
        if (now > script_.front().end_time)
        {
            interprocess().publish<groups::script_step_end>(script_.front().step);
            script_.pop_front();
            if (!script_.empty())
                run_step(script_.front(), false);
            else
                resume_mission();
        }
        else if (now > script_.front().next_time)
        {
            run_step(script_.front(), true);
        }
    }
}

void jaiabot::apps::MissionRepeater::run_step(ScriptStep& script_step, bool is_repeat)
{
    const auto& step = script_step.step;

    if (!is_repeat)
    {
        glog.is_verbose() && glog << "Executing step: " << step.ShortDebugString() << std::endl;

        interprocess().publish<groups::script_step_begin>(step);
    }

    auto repeat_interval =
        step.has_repeat_interval() ? step.repeat_interval_with_units() : step.duration_with_units();
    script_step.next_time +=
        goby::time::convert_duration<goby::time::SteadyClock::duration>(repeat_interval);

    switch (step.publication_case())
    {
        case config::MissionRepeater::Script::Step::kLowControl:
            interprocess().publish<groups::low_control>(step.low_control());
            break;
        case config::MissionRepeater::Script::Step::kDesiredSetpoints:
            interprocess().publish<groups::desired_setpoints>(step.desired_setpoints());
            break;
    }
}
void jaiabot::apps::MissionRepeater::resume_mission()
{
    script_running_ = false;

    glog.is_verbose() && glog << "Script ended, resuming mission" << std::endl;

    protobuf::Command command;
    command.set_bot_id(cfg().bot_id());
    command.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    command.set_type(protobuf::Command::RESUME);
    interprocess().publish<jaiabot::groups::self_command>(command);
}

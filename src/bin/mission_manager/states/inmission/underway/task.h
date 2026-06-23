// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
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

// Task

struct Task : boost::statechart::state<Task, Underway, task::TaskSelection>, AppMethodsAccess<Task>

{
    using StateBase = boost::statechart::state<Task, Underway, task::TaskSelection>;

    Task(typename StateBase::my_context c)
    : StateBase(c)
    {
        goby::glog.is_debug2() && goby::glog << "Entering Task" << std::endl;
        auto perform_task_event = dynamic_cast<const EvPerformTask*>(triggering_event());
        if (perform_task_event && perform_task_event->has_task)
        {
            manual_task_ = perform_task_event->task;
            has_manual_task_ = true;
        }

        task_packet_.set_bot_id(cfg().bot_id());

        task_packet_.set_start_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        boost::optional<protobuf::MissionTask> current_task = context<Task>().current_task();
        task_packet_.set_type(current_task ? current_task->type() : protobuf::MissionTask::NONE);
        task_packet_.set_mission_command_time(this->machine().mission_command_time());
    }

    ~Task()
    {
        auto task_complete_event = dynamic_cast<const EvTaskComplete*>(triggering_event());
        // each time we complete a autonomous task - we should increment the goal index
        // do not increment for other triggering events, such as EvIMURestart or EvGPSFix
        if (!has_manual_task_ && task_complete_event)
        {
            if (task_packet_.type() == protobuf::MissionTask::DIVE && task_packet_.has_dive() &&
                task_packet_.dive().reached_min_depth())
            {
                goby::glog.is_debug1() &&
                    goby::glog << "Minimum depth was reached, do not increment waypoint index"
                            << std::endl;
            }
            else
            {
                goby::glog.is_debug1() && goby::glog << "Increment Waypoint index" << std::endl;
                context<InMission>().increment_goal_index();
            }
        }

        task_packet_.set_end_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

        if (task_packet_.type() == protobuf::MissionTask::DIVE)
        {
            glog.is_debug2() && glog << "Publishing task packet interprocess: " << task_packet_.DebugString() << std::endl;
            protobuf::FusionMessage fusion_msg;
            *fusion_msg.mutable_task_packet() = task_packet_;
            interprocess().publish<groups::fusion>(fusion_msg);
        }

    }

    // see if we have a manual task or a planned task available and return it
    boost::optional<protobuf::MissionTask> current_task()
    {
        if (has_manual_task_)
            return boost::optional<protobuf::MissionTask>(manual_task_);
        else
            return context<InMission>().current_planned_task();
    }

    jaiabot::protobuf::TaskPacket& task_packet() { return task_packet_; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvTaskComplete,
                                      boost::statechart::deep_history<movement::Transit // default
                                                                      >>>;

  private:
    protobuf::MissionTask manual_task_;
    bool has_manual_task_{false};
    jaiabot::protobuf::TaskPacket task_packet_;
};

namespace task {

    #include "task/surface_drift_task_common.h"
    #include "task/dive.h"
    #include "task/task_selection.h"
    #include "task/surface_drift.h"
    #include "task/constant_heading.h"
    #include "task/station_keep.h"

} // namespace jaiabot::statechart::inmission::underway::task

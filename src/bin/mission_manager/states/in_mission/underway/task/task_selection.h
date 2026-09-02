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

// similar to MovementSelection but for Tasks
#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct TaskSelection;
#else
struct TaskSelection : boost::statechart::state<TaskSelection, Task>,
                       AppMethodsAccess<TaskSelection>
{
    struct EvTaskSelect : boost::statechart::event<EvTaskSelect>
    {
    };

    using StateBase = boost::statechart::state<TaskSelection, Task>;
    TaskSelection(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug2() && goby::glog << group("task") << "Entering TaskSelect" << std::endl;
        post_event(EvTaskSelect());
    }
    ~TaskSelection() {}

    boost::statechart::result react(const EvTaskSelect&)
    {
        boost::optional<protobuf::MissionTask> current_task = context<Task>().current_task();

        if (current_task && current_task->type() != protobuf::MissionTask::NONE)
        {
            goby::glog.is_verbose() && goby::glog << group("task") << "Starting task: "
                                                  << current_task.get().ShortDebugString()
                                                  << std::endl;

            switch (current_task->type())
            {
                case protobuf::MissionTask::NONE: return discard_event();
                case protobuf::MissionTask::STORM_AIR_DESCENT:
                    // used to report STORM air descent TaskPacket - not a regular task we can
                    // perform, so treat it as already complete and move on to the next goal
                    post_event(EvTaskComplete());
                    return discard_event();
                case protobuf::MissionTask::DIVE: return transit<Dive>();
                case protobuf::MissionTask::STATION_KEEP: return transit<StationKeep>();
                case protobuf::MissionTask::SURFACE_DRIFT: return transit<SurfaceDrift>();
                case protobuf::MissionTask::CONSTANT_HEADING: return transit<ConstantHeading>();
            }
        }

        // no task or invalid task, so consider it complete
        goby::glog.is_verbose() && goby::glog << group("task")
                                              << "No task for this goal. Proceeding to next goal"
                                              << std::endl;
        post_event(EvTaskComplete());
        return discard_event();
    }

    using reactions = boost::statechart::custom_reaction<EvTaskSelect>;
};
#endif

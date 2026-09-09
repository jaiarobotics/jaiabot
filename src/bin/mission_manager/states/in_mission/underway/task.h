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

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct Task;
#else
struct Task : boost::statechart::state<Task, Underway, task::TaskSelection>, AppMethodsAccess<Task>

{
    using StateBase = boost::statechart::state<Task, Underway, task::TaskSelection>;

    Task(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug2() && goby::glog << "Entering Task" << std::endl;
        auto perform_task_event = dynamic_cast<const EvPerformTask*>(triggering_event());
        if (perform_task_event && perform_task_event->has_task)
        {
            manual_task_ = perform_task_event->task;
            has_manual_task_ = true;
        }

        task_packet_.set_bot_id(cfg().bot_id());

        task_packet_.set_start_time_with_units(
            goby::time::SystemClock::now<goby::time::MicroTime>());
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

        if (task_packet_.type() == protobuf::MissionTask::DIVE ||
            task_packet_.type() == protobuf::MissionTask::SURFACE_DRIFT)
        {
            if (cfg().data_offload_exclude() != config::MissionManager::TASKPACKET)
            {
                // Convert to json string
                std::string json_string;
                google::protobuf::util::JsonPrintOptions json_options;
                // Set the snake_case option
                json_options.preserve_proto_field_names = true;

                google::protobuf::util::MessageToJsonString(task_packet_, &json_string,
                                                            json_options);

                // Check if it is a new task packet file
                if (this->machine().create_task_packet_file())
                {
                    this->machine().set_task_packet_file_name(
                        cfg().interprocess().platform() + "_" +
                        this->machine().create_file_date_time() + ".taskpacket");
                    this->machine().set_create_task_packet_file(false);
                }
                else
                {
                    json_string = "\n" + json_string;
                }

                // Open task packet file
                std::ofstream task_packet_file(
                    cfg().log_dir() + "/" + this->machine().task_packet_file_name(), std::ios::app);

                task_packet_file << json_string;

                // Close the json file
                task_packet_file.close();
            }

            if (this->machine().rf_disable() || !this->cfg().send_task_packets_to_hub())
            {
                glog.is_debug2() &&
                    glog << "(Not sending TaskPackets to Hub) Publishing task packet interprocess: "
                         << task_packet_.DebugString() << std::endl;
                interprocess().publish<groups::task_packet>(task_packet_);
            }
            else
            {
                glog.is_debug2() &&
                    glog << "(Sending TaskPackets to Hub) Publishing task packet intervehicle: "
                         << task_packet_.DebugString() << std::endl;
                intervehicle().publish<groups::task_packet>(
                    task_packet_, intervehicle::default_publisher<protobuf::TaskPacket>);
            }
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

namespace task
{
#include "task/surface_drift_task_common.h"
}

#endif

namespace task
{
#include "task/constant_heading.h"
#include "task/dive.h"
#include "task/station_keep.h"
#include "task/surface_drift.h"
#include "task/task_selection.h"

} // namespace task

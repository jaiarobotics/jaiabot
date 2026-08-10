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

// This file contains the definition of the InMission state and its substates.

struct InMission
    : boost::statechart::state<InMission, MissionManagerStateMachine, inmission::Underway>,
      AppMethodsAccess<InMission>
{
    constexpr static int RECOVERY_GOAL_INDEX{-1};
    constexpr static int SURF_EGRESS_GOAL_INDEX{-2};

    using StateBase =
        boost::statechart::state<InMission, MissionManagerStateMachine, inmission::Underway>;

    InMission(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "InMission" << std::endl;
    }
    ~InMission()
    {
        goby::glog.is_debug1() && goby::glog << "~InMission" << std::endl;
    }

    int goal_index() const { return goal_index_; }

    int repeat_index() const { return repeat_index_; }

    boost::optional<protobuf::MissionPlan::Goal> current_goal() const
    {
        if (goal_index() >= this->machine().mission_plan().goal_size() ||
            goal_index() == RECOVERY_GOAL_INDEX)
            return boost::none;
        else
            return boost::optional<protobuf::MissionPlan::Goal>(
                this->machine().mission_plan().goal(goal_index()));
    }

    protobuf::MissionPlan::Goal final_goal() const
    {
        const auto& mission_plan = this->machine().mission_plan();
        return mission_plan.goal(mission_plan.goal_size() - 1);
    }

    boost::optional<protobuf::MissionTask> current_planned_task() const
    {
        if (mission_complete_)
            return boost::none;

        const auto& plan = this->machine().mission_plan();
        if (!plan.goal(goal_index()).has_task())
            return boost::none;
        else
            return boost::optional<protobuf::MissionTask>(plan.goal(goal_index()).task());
    }

    void increment_goal_index()
    {
        const auto& repeats = this->machine().mission_plan().repeats();
        const auto& goal_size = this->machine().mission_plan().goal_size();

        ++goal_index_;

        // all goals completed
        if (goal_index_ >= goal_size)
        {
            ++repeat_index_;

            goby::glog.is_verbose() && goby::glog << group("movement") << "Repeat " << repeat_index_
                                                  << "/" << repeats << ": all goals complete"
                                                  << std::endl;

            // all repeats completed
            if (repeat_index_ >= repeats)
            {
                goby::glog.is_verbose() &&
                    goby::glog << group("movement") << "All repeats complete, mission is complete."
                               << std::endl;
                set_mission_complete();
                goal_index_ = RECOVERY_GOAL_INDEX;
            }
            else
            {
                // Do next repeat, starting with first goal
                goal_index_ = 0;
            }
        }
    }

    void set_goal_index_to_final_goal()
    {
        // Sets goal index to be the final goal index
        goal_index_ = (this->machine().mission_plan().goal_size() - 1);
    }
    void resume_after_srp_egress()
    {
        const auto& mission_plan = this->machine().mission_plan();
        const int total_goals = mission_plan.goal_size();

        for (int i = goal_index_; i < total_goals; ++i)
        {
            const auto& goal = mission_plan.goal(i);

            if (goal.has_task() && goal.task().type() == protobuf::MissionTask::CONSTANT_HEADING)
            {
                if (i + 1 < total_goals)
                {
                    goal_index_ = i + 1;
                    goby::glog.is_verbose() &&
                        goby::glog << group("goal") << "Found CONSTANT_HEADING at index " << i
                                   << ", advancing to goal index: " << goal_index_ << std::endl;
                }
                else
                {
                    goby::glog.is_warn() &&
                        goby::glog << group("goal")
                                   << "CONSTANT_HEADING was the last goal. Proceeding to recovery."
                                   << std::endl;
                    set_goal_index_to_final_goal();
                }
                // Stop after handling the first CONSTANT_HEADING
                return;
            }
        }

        // No CONSTANT_HEADING found from current index onward
        goby::glog.is_warn() &&
            goby::glog << group("goal") << "No CONSTANT_HEADING task found from goal index "
                       << goal_index_ << " onward. Proceeding to recovery." << std::endl;
        set_goal_index_to_final_goal();
    }
    void set_goal_index_to_recovery()
    {
        // Sets goal index to be the recovery goal
        goal_index_ = RECOVERY_GOAL_INDEX;
    }

    void set_mission_complete() { mission_complete_ = true; }

    void set_use_heading_constant_pid(const bool& use_heading_constant_pid)
    {
        use_heading_constant_pid_ = use_heading_constant_pid;
    }

    bool use_heading_constant_pid() const { return use_heading_constant_pid_; }

    void set_is_pam_recording(const bool& is_pam_recording)
    {
        is_pam_recording_ = is_pam_recording;
    }

    bool is_pam_recording() const { return is_pam_recording_; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvNewMission, inmission::underway::Replan>,
        boost::statechart::transition<EvRecovered, PostDeployment>,
        boost::statechart::transition<EvAbort, inmission::underway::Abort>,
        boost::statechart::transition<EvStop, inmission::underway::recovery::Stopped>>;

  private:
    int goal_index_{0};
    int repeat_index_{0};
    bool mission_complete_{false};
    bool use_heading_constant_pid_{false};
    bool is_pam_recording_{false};
};

namespace inmission {

    #include "inmission/underway.h"
    #include "inmission/pause.h"

}

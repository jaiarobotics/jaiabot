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

        apply_segment_params();
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

        if (active_seg_index_ + 1 < this->machine().mission_plan().segments_size())
        {
            const auto& next_seg = this->machine().mission_plan().segments(active_seg_index_ + 1);
            if (goal_index_ >= next_seg.start_goal_index())
            {
                active_seg_index_++;
                apply_segment_params();
            }
        }

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

        apply_segment_params();
    }

    void set_goal_index_to_final_goal()
    {
        // Sets goal index to be the final goal index
        goal_index_ = (this->machine().mission_plan().goal_size() - 1);
    }
    void resume_after_srp_egress()
    {
        if (active_seg_index_ >= this->machine().mission_plan().segments_size())
        {
            glog.is_debug1() && glog << "No segments, go to final waypoint" << std::endl;
            set_goal_index_to_final_goal();
            return;
        }
        
        protobuf::MissionPlan::Segment active_seg =  this->machine().mission_plan().segments(active_seg_index_);

        for (int i = 0; i < active_seg.lane_start_goal_indices_size(); i++)
        {
            int lane_start_index = active_seg.lane_start_goal_indices(i);
            if (lane_start_index > goal_index_)
            {
                glog.is_debug1() && glog << "Go to next lane" << std::endl;
                goal_index_ = lane_start_index;
                return;
            }
        }

        if (active_seg_index_ + 1 >= this->machine().mission_plan().segments_size()) {
            glog.is_debug1() && glog << "No more lanes and no more segments, go to final waypoint" << std::endl;
            set_goal_index_to_final_goal(); 
            return;
        }

        protobuf::MissionPlan::Segment next_seg =  this->machine().mission_plan().segments(active_seg_index_ + 1 );
        glog.is_debug1() && glog << "Go to last goal in segment" << std::endl;
        goal_index_ = next_seg.start_goal_index() - 1;
        return;

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

    void set_is_echo_recording(const bool& is_echo_recording)
    {
        is_echo_recording_ = is_echo_recording;
    }

    bool is_echo_recording() const { return is_echo_recording_; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvNewMission, inmission::underway::Replan>,
        boost::statechart::transition<EvRecovered, PostDeployment>,
        boost::statechart::transition<EvAbort, inmission::underway::Abort>,
        boost::statechart::transition<EvStop, inmission::underway::recovery::Stopped>>;

  private:
    void apply_segment_params()
    {
        const auto& mission_plan = this->machine().mission_plan();
        if (mission_plan.segments_size() == 0)
            return;

        const protobuf::MissionPlan::Segment* active_seg = nullptr;
        active_seg = &mission_plan.segments(active_seg_index_);

        if (!active_seg)
            return;

        if (active_seg->has_speed())
            this->machine().set_transit_speed(active_seg->speed_with_units());

        if (active_seg->has_bottom_depth_safety_params())
        {
            const auto& bds = active_seg->bottom_depth_safety_params();
            this->machine().set_bottom_depth_safety_constant_heading(bds.constant_heading());
            this->machine().set_bottom_depth_safety_constant_heading_speed(
                bds.constant_heading_speed());
            this->machine().set_bottom_depth_safety_constant_heading_time(
                bds.constant_heading_time());
            this->machine().set_bottom_safety_depth(bds.safety_depth());
        }
    }

    int goal_index_{0};
    int active_seg_index_{0};
    int repeat_index_{0};
    bool mission_complete_{false};
    bool use_heading_constant_pid_{false};
    bool is_echo_recording_{false};
};

namespace inmission {

    #include "inmission/underway.h"
    #include "inmission/pause.h"

}

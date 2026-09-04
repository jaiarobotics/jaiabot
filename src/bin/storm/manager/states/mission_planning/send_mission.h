// Copyright 2026:
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

#ifdef JAIABOT_STORM_MANAGER_FWD_DECL
struct SendMission;
#else

#include "jaiabot/groups.h"

struct SendMission : boost::statechart::state<SendMission, MissionPlanning>,
                     Notify<SendMission, protobuf::MISSION_PLANNING__SEND_MISSION>
{
    using StateBase = boost::statechart::state<SendMission, MissionPlanning>;

    SendMission(typename StateBase::my_context c) : StateBase(c) { try_send_mission(); }
    ~SendMission() {}

    void loop(const EvLoop& ev) { try_send_mission(); }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvMissionRunning, MissionRunning>,
        boost::statechart::in_state_reaction<EvLoop, SendMission, &SendMission::loop>>;

  private:
    void try_send_mission()
    {
        if (sent_)
            return;

        // wait for a real GPS fix before commanding a mission; latest_location()
        // defaults to (0, 0) until set_latest_location() is called
        if (!this->machine().has_latest_location())
        {
            goby::glog.is_warn() &&
                goby::glog << group("statechart")
                           << "Waiting for a valid location before sending mission" << std::endl;
            return;
        }

        // create a regular mission and send it over to jaiabot_mission_manager
        protobuf::Command command;
        command.set_bot_id(cfg().bot_id());
        command.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        command.set_type(protobuf::Command::MISSION_PLAN);

        auto& mission_plan = *command.mutable_plan();
        mission_plan.set_start(protobuf::MissionPlan::START_IMMEDIATELY);
        mission_plan.set_movement(protobuf::MissionPlan::TRANSIT);

        auto& goal = *mission_plan.add_goal();
        *goal.mutable_location() = this->machine().latest_location();

        auto& task = *goal.mutable_task();
        task.set_type(protobuf::MissionTask::DIVE);
        *task.mutable_dive() = this->machine().mission().dive();

        auto& recovery = *mission_plan.mutable_recovery();
        recovery.set_recover_at_final_goal(true);
        recovery.set_sleep_once_goal_reached(true);

        goby::glog.is_verbose() && goby::glog << group("statechart")
                                              << "Sending command: " << command.ShortDebugString()
                                              << std::endl;
        this->interprocess().publish<::jaiabot::groups::self_command>(command);
        sent_ = true;
    }

    bool sent_{false};
};
#endif

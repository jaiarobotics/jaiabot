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
struct WaitForRemoteMission;
#else
struct WaitForRemoteMission
    : boost::statechart::state<WaitForRemoteMission, MissionPlanning>,
      Notify<WaitForRemoteMission, protobuf::MISSION_PLANNING__WAIT_FOR_REMOTE_MISSION>
{
    using StateBase = boost::statechart::state<WaitForRemoteMission, MissionPlanning>;

    WaitForRemoteMission(typename StateBase::my_context c) : StateBase(c) {}
    ~WaitForRemoteMission() {}

    void loop(const EvLoop& ev)
    {
        auto now = goby::time::SteadyClock::now();
        if (now >= new_mission_timeout_)
            post_event(EvRemoteMissionTimeout());
    }

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvRemoteMissionTimeout, SendMission>,
                         boost::statechart::transition<EvRemoteMissionReceived, SendMission>,
                         boost::statechart::in_state_reaction<EvLoop, WaitForRemoteMission,
                                                              &WaitForRemoteMission::loop>>;

  private:
    goby::time::SteadyClock::time_point new_mission_timeout_{
        goby::time::SteadyClock::now() +
        goby::time::convert_duration<goby::time::SteadyClock::duration>(
            this->machine().mission().remote_mission_wait_minutes_with_units())};
};
#endif

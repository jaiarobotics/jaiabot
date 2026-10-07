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
struct WaitForMissionManager;
#else
struct WaitForMissionManager
    : boost::statechart::state<WaitForMissionManager, MissionPlanning>,
      Notify<WaitForMissionManager, protobuf::MISSION_PLANNING__WAIT_FOR_MISSION_MANAGER>
{
    using StateBase = boost::statechart::state<WaitForMissionManager, MissionPlanning>;

    WaitForMissionManager(typename StateBase::my_context c) : StateBase(c) {}
    ~WaitForMissionManager() {}

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvMissionManagerReadyForMission, WaitForRemoteMission>>;
};
#endif

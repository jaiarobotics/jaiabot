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
struct MissionPlanning;
#else
struct MissionPlanning : boost::statechart::state<MissionPlanning, StormManagerStateMachine,
                                                  mission_planning::WaitForMissionManager>,
                         AppMethodsAccess<MissionPlanning>
{
    using StateBase = boost::statechart::state<MissionPlanning, StormManagerStateMachine,
                                               mission_planning::WaitForMissionManager>;

    MissionPlanning(typename StateBase::my_context c) : StateBase(c) {}
    ~MissionPlanning() {}

    using reactions = boost::mpl::list<>;
};
#endif

namespace mission_planning
{

#include "mission_planning/send_mission.h"
#include "mission_planning/wait_for_mission_manager.h"
#include "mission_planning/wait_for_remote_mission.h"

} // namespace mission_planning

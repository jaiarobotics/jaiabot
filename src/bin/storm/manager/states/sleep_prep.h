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
struct SleepPrep;
#else

#include "jaiabot/groups.h"

struct SleepPrep
    : boost::statechart::state<SleepPrep, StormManagerStateMachine, sleep_prep::DataOffload>,
      AppMethodsAccess<SleepPrep>
{
    using StateBase =
        boost::statechart::state<SleepPrep, StormManagerStateMachine, sleep_prep::DataOffload>;

    SleepPrep(typename StateBase::my_context c) : StateBase(c) {}
    ~SleepPrep()
    {
        // inform jaiabot_mission_manager of the result of this delegated state
        protobuf::MissionStateDelegateResponse resp;
        resp.set_state(protobuf::IN_MISSION__UNDERWAY__SLEEP__PREP);
        resp.set_event(protobuf::MissionStateDelegateResponse::EV_SHUTDOWN);
        interprocess().publish<::jaiabot::groups::state_delegate_response>(resp);
    }

    using reactions = boost::mpl::list<>;
};
#endif

namespace sleep_prep
{

#include "sleep_prep/data_offload.h"
#include "sleep_prep/wrapup.h"

} // namespace sleep_prep

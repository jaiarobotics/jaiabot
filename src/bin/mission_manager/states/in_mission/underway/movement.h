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

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct Movement;
#else
struct Movement : boost::statechart::state<Movement, Underway, movement::MovementSelection,
                                           boost::statechart::has_deep_history>,
                  AppMethodsAccess<Movement>
{
    using StateBase = boost::statechart::state<Movement, Underway, movement::MovementSelection,
                                               boost::statechart::has_deep_history>;

    Movement(typename StateBase::my_context c) : StateBase(c)
    {
        // replan case - update mission from event
        auto mission_feasible_event = dynamic_cast<const EvMissionFeasible*>(triggering_event());
        if (mission_feasible_event)
        {
            this->machine().set_mission_plan(
                mission_feasible_event->plan,
                false); // do not reset the datum on Replanned missions to avoid a race condition with IvP
        }
    }
    ~Movement() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvPerformTask, Task>>;
};

#include "ivp_sensor_pause_common.h"
#endif

namespace movement {

    #include "movement/transit.h"
    #include "movement/trail.h"
    #include "movement/movement_selection.h"
    #include "movement/remote_control.h"

}

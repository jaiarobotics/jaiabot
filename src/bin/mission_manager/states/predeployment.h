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

// This file contains the definition of the PreDeployment state and its substates.

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct PreDeployment;
#else
struct PreDeployment
: boost::statechart::state<PreDeployment,              // (CRTP)
                            MissionManagerStateMachine, // Parent state (or machine)
                            predeployment::StartingUp   // Initial child substate
                            >
{
    using StateBase = boost::statechart::state<PreDeployment, MissionManagerStateMachine,
                                               predeployment::StartingUp>;

    // entry action
    PreDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PreDeployment() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, postdeployment::ShuttingDown>,
                         boost::statechart::transition<EvRecovered, postdeployment::Recovered>>;
};
#endif

namespace predeployment
{

    #include "predeployment/starting_up.h"
    #include "predeployment/idle.h"
    #include "predeployment/self_test.h"
    #include "predeployment/failed.h"
    #include "predeployment/wait_for_mission_plan.h"
    #include "predeployment/ready.h"

} // namespace predeployment

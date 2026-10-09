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
                            pre_deployment::StartingUp   // Initial child substate
                            >
{
    using StateBase = boost::statechart::state<PreDeployment, MissionManagerStateMachine,
                                               pre_deployment::StartingUp>;

    // entry action
    PreDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PreDeployment() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, post_deployment::ShuttingDown>,
                         boost::statechart::transition<EvRecovered, post_deployment::Recovered>>;
};
#endif

namespace pre_deployment
{

    #include "pre_deployment/starting_up.h"
    #include "pre_deployment/idle.h"
    #include "pre_deployment/self_test.h"
    #include "pre_deployment/failed.h"
    #include "pre_deployment/wait_for_mission_plan.h"
    #include "pre_deployment/ready.h"

} // namespace pre_deployment

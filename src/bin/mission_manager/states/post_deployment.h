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

// This file contains the definition of the PostDeployment state and its substates.

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct PostDeployment;
#else
struct PostDeployment : boost::statechart::state<PostDeployment, MissionManagerStateMachine,
                                                 post_deployment::Recovered>
{
    using StateBase = boost::statechart::state<PostDeployment, MissionManagerStateMachine,
                                               post_deployment::Recovered>;

    // entry action
    PostDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PostDeployment() {}
};
#endif

namespace post_deployment
{

    #include "post_deployment/idle.h"
    #include "post_deployment/failed.h"
    #include "post_deployment/shutting_down.h"
    #include "post_deployment/recovered.h"
    #include "post_deployment/data_offload.h"

} // namespace post_deployment

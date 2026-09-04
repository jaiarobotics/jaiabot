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
struct RemoteControl;
#else
struct RemoteControl
    : boost::statechart::state<RemoteControl, Movement, remote_control::RemoteControlEndSelection>
{
    using StateBase =
        boost::statechart::state<RemoteControl, Movement, remote_control::RemoteControlEndSelection>;
    RemoteControl(typename StateBase::my_context c) : StateBase(c) {}
    ~RemoteControl() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvResumeMovement, Movement>>;
};
#endif

namespace remote_control
{

    #include "remote_control/remote_control_end_selection.h"
    #include "remote_control/station_keep.h"
    #include "remote_control/surface_drift.h"
    #include "remote_control/setpoint.h"

}

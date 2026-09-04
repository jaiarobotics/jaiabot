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
struct Underway;
#else
struct Underway : boost::statechart::state<Underway, InMission, underway::Movement,
                                           boost::statechart::has_deep_history>,
                  AppMethodsAccess<Underway>
{
    using StateBase = boost::statechart::state<Underway, InMission, underway::Movement,
                                               boost::statechart::has_deep_history>;

    Underway(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "Underway" << std::endl;
    }
    ~Underway() { goby::glog.is_debug1() && goby::glog << "~Underway" << std::endl; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvReturnToHome, underway::Recovery>,
        boost::statechart::transition<EvRCSetpoint, underway::movement::remote_control::Setpoint>,
        boost::statechart::transition<EvPause, pause::Manual>,
        boost::statechart::transition<EvNoForwardProgress, pause::ResolveNoForwardProgress>>;
};
#endif

namespace underway {

    #include "underway/abort.h"
    #include "underway/movement.h"
    #include "underway/recovery.h"
    #include "underway/task.h"
    #include "underway/replan.h"
    #include "underway/sleep.h"
} // namespace jaiabot::statechart::in_mission::underway

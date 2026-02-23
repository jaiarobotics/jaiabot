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
struct LaunchTubeDetection;
#else
struct LaunchTubeDetection : boost::statechart::state<LaunchTubeDetection, SelfTest>,
                             Notify<LaunchTubeDetection, protobuf::SELF_TEST__LAUNCH_TUBE_DETECTION>
{
    using StateBase = boost::statechart::state<LaunchTubeDetection, SelfTest>;

    LaunchTubeDetection(typename StateBase::my_context c) : StateBase(c) {}
    ~LaunchTubeDetection() {}

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvLaunchTubeCleared, ParachuteAttachmentDetection>,
        boost::statechart::transition<EvLaunchTubeStuck, LaunchTubeRecovery>>;
};
#endif

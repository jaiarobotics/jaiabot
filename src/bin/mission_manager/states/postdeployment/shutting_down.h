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
struct ShuttingDown;
#else
struct ShuttingDown : boost::statechart::state<ShuttingDown, PostDeployment>,
                      Notify<ShuttingDown, protobuf::POST_DEPLOYMENT__SHUTTING_DOWN>
{
    using StateBase = boost::statechart::state<ShuttingDown, PostDeployment>;

    ShuttingDown(typename StateBase::my_context c) 
    : StateBase(c)
    {
        protobuf::Command shutdown;
        shutdown.set_bot_id(cfg().bot_id());
        shutdown.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        shutdown.set_type(protobuf::Command::SHUTDOWN_COMPUTER);
        // publish computer shutdown command to jaiabot_health which is run as root so it
        // can actually carry out the shutdown
        this->interprocess().template publish<jaiabot::groups::powerstate_command>(shutdown);
    }

    ~ShuttingDown() {}
};
#endif

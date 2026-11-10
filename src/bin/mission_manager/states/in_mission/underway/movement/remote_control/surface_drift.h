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
struct SurfaceDrift;
#else
struct SurfaceDrift
    : boost::statechart::state<SurfaceDrift, RemoteControl>,
      Notify<SurfaceDrift, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<SurfaceDrift, RemoteControl>;
    SurfaceDrift(typename StateBase::my_context c) : StateBase(c)
    {
        // Stop the craft
        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }
    ~SurfaceDrift() {}

    void loop(const EvLoop&)
    {
    }

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, SurfaceDrift, &SurfaceDrift::loop>>;
};

#endif

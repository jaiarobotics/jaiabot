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

// dummy state that should immediately transit to the correct RemoteControl child state based on the configured rc_setpoint_end value
#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct RemoteControlEndSelection;
#else
struct RemoteControlEndSelection
    : boost::statechart::state<RemoteControlEndSelection, RemoteControl>,
      AppMethodsAccess<RemoteControlEndSelection>
{
    struct EvRCEndSelect : boost::statechart::event<EvRCEndSelect>
    {
    };

    using StateBase = boost::statechart::state<RemoteControlEndSelection, RemoteControl>;
    RemoteControlEndSelection(typename StateBase::my_context c) : StateBase(c)
    {
        post_event(EvRCEndSelect());
    }
    ~RemoteControlEndSelection() {}

    boost::statechart::result react(const EvRCEndSelect&)
    {
        switch (this->cfg().rc_setpoint_end())
        {
            case config::MissionManager::RC_SETPOINT_ENDS_IN_STATIONKEEP: return transit<StationKeep>();
            case config::MissionManager::RC_SETPOINT_ENDS_IN_SURFACE_DRIFT:
                return transit<SurfaceDrift>();
        }

        // should never reach here but if does, abort the mission
        return transit<underway::Abort>();
    }

    using reactions = boost::statechart::custom_reaction<EvRCEndSelect>;
};
#endif

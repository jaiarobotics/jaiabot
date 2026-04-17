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

struct StationKeep : boost::statechart::state<StationKeep, Battery>,
      Notify<StationKeep, protobuf::IN_MISSION__BATTERY__STATION_KEEP>
{
    using StateBase = boost::statechart::state<StationKeep, Battery>;

    StationKeep(typename StateBase::my_context c) : StateBase(c)
    {
        glog.is_warn() && glog << "StationKeep" << std::endl;

        boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();

        IvPBehaviorUpdate update;

        // Just use our current location, since we're in a low battery state and need to conserve power.
        update = create_center_activate_stationkeep_update(
            this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().mission_plan().speeds().stationkeep_outer_with_units());

        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    ~StationKeep()
    {
        glog.is_debug1() && glog << "~StationKeep" << std::endl;
    }

};

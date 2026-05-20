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
        glog.is_debug1() && glog << "battery::StationKeep" << std::endl;

        // Set the triggering battery level based on the event that caused the transition to this state
        // So we only transition to a new battery protocol if the battery level drops further from the level that triggered the current protocol
        auto ev_start_battery_protocol = dynamic_cast<const EvStartBatteryProtocol*>(triggering_event());
        if (ev_start_battery_protocol)
        {
            context<Battery>().triggering_battery_level = ev_start_battery_protocol->battery_level;
        }

        boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();

        // Station Keep to our current location
        auto update = create_center_activate_stationkeep_update(
            this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().mission_plan().speeds().stationkeep_outer_with_units());
        glog.is_debug1() && glog << "Starting battery protocol station keep with current location"
                                 << std::endl;

        glog.is_debug1() && glog << "IvP Update: " << update.ShortDebugString() << std::endl;

        // Tell the state machine to relay the DesiredCourse messages from pHelpIvP
        this->machine().set_setpoint_type(protobuf::SETPOINT_IVP_HELM);
        // Publish the station keep update to pHelmIvP
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    ~StationKeep()
    {
        glog.is_debug1() && glog << "battery::~StationKeep" << std::endl;
    }

};

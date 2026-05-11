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

struct Battery : boost::statechart::state<Battery, InMission, battery::StationKeep>, AppMethodsAccess<Battery>
{
    using StateBase = boost::statechart::state<Battery, InMission, battery::StationKeep>;

    BatteryLevel triggering_battery_level = BatteryLevel::NORMAL;

    Battery(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "Battery" << std::endl;
    }
    ~Battery() { goby::glog.is_debug1() && goby::glog << "~Battery" << std::endl; }


    void battery_level_reaction(const EvBatteryLevel& ev)
    {
        auto battery_level = ev.battery_level;

        // Only start a new battery protocol if the battery level has dropped further since the last protocol was triggered
        if (battery_level < triggering_battery_level)
        {
            context<InMission>().start_battery_protocol(battery_level);
        }
        else {
            glog.is_debug1() && glog << "Received new EvBatteryLevel event with battery level: "
                                  << static_cast<int>(battery_level)
                                  << " which is not lower than the triggering battery level: "
                                  << static_cast<int>(triggering_battery_level)
                                  << ". Not starting a new battery protocol."
                                  << std::endl;
        }
    }

    using reactions = boost::mpl::list<boost::statechart::in_state_reaction<EvBatteryLevel, Battery, &Battery::battery_level_reaction>>;

};

namespace battery {
#include "battery/station_keep.h"
#include "battery/stop_and_broadcast.h"
}

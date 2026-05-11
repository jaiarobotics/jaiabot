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

struct StopAndBroadcast : boost::statechart::state<StopAndBroadcast, Battery>,
      Notify<StopAndBroadcast, protobuf::IN_MISSION__BATTERY__STOP_AND_BROADCAST>
{
    using StateBase = boost::statechart::state<StopAndBroadcast, Battery>;

    StopAndBroadcast(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "battery::StopAndBroadcast" << std::endl;

        // Set the triggering battery level based on the event that caused the transition to this state
        // So we only transition to a new battery protocol if the battery level drops further from the level that triggered the current protocol
        auto ev_start_battery_protocol = dynamic_cast<const EvStartBatteryProtocol*>(triggering_event());
        if (ev_start_battery_protocol)
        {
            context<Battery>().triggering_battery_level = ev_start_battery_protocol->battery_level;
        }

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }
    ~StopAndBroadcast() { goby::glog.is_debug1() && goby::glog << "battery::~StopAndBroadcast" << std::endl; }

};

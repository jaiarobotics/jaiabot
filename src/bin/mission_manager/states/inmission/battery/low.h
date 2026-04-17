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

struct Low
    : boost::statechart::state<Low, Battery>,
      Notify<Low, protobuf::IN_MISSION__BATTERY__LOW>
{
    using StateBase = boost::statechart::state<Low, Battery>;


    Low(typename StateBase::my_context c) : StateBase(c)
    {
        glog.is_warn() && glog << "Battery low!" << std::endl;

        const jaiabot::protobuf::MissionPlan::BatteryLowProtocol protocol = this->machine().mission_plan().very_low_battery_protocol();

        switch (protocol.action())
        {
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::STOP_AND_BROADCAST:
            glog.is_warn() && glog << "Critical battery protocol: STOP_AND_BROADCAST" << std::endl;
            this->post_event(EvLowBatteryStopAndBroadcast());
            break;
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::STATION_KEEP:
            glog.is_warn() && glog << "Critical battery protocol: STATION_KEEP" << std::endl;
            this->post_event(EvLowBatteryStationKeep());
            break;
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::DRIVE_TO_HUB:
            glog.is_warn() && glog << "Critical battery protocol: DRIVE_TO_HUB" << std::endl;
            break;
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::DRIVE_TO_LOCATION:
            glog.is_warn() && glog << "Critical battery protocol: DRIVE_TO_LOCATION" << std::endl;
            break;
        default:
            glog.is_warn() && glog << "Critical battery protocol: UNKNOWN" << std::endl;
            break;
        }
        
    }

    ~Low(){};

    using reactions = boost::mpl::list<boost::statechart::transition<EvLowBatteryStopAndBroadcast, StopAndBroadcast>,
                                       boost::statechart::transition<EvLowBatteryStationKeep, StationKeep>>;

};

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

    /**
     * @brief Handle the battery protocol by posting the appropriate event to the state machine.
     * 
     * @param protocol The battery low protocol to execute.
     */
    void do_battery_protocol(const jaiabot::protobuf::MissionPlan::BatteryLowProtocol& protocol)
    {
        switch (protocol.action())
        {
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::NONE:
            glog.is_warn() && glog << "Battery protocol: NONE" << std::endl;
            break;
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::STOP_AND_BROADCAST:
            glog.is_warn() && glog << "Battery protocol: STOP_AND_BROADCAST" << std::endl;
            this->post_event(EvLowBatteryStopAndBroadcast());
            break;
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::STATION_KEEP:
            glog.is_warn() && glog << "Battery protocol: STATION_KEEP" << std::endl;
            this->post_event(EvLowBatteryStationKeep());
            break;
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::DRIVE_TO_HUB:
            glog.is_warn() && glog << "Battery protocol: DRIVE_TO_HUB" << std::endl;
            break;
        case jaiabot::protobuf::MissionPlan::BatteryLowProtocol::DRIVE_TO_LOCATION:
            glog.is_warn() && glog << "Battery protocol: DRIVE_TO_LOCATION" << std::endl;
            break;
        default:
            glog.is_warn() && glog << "Battery protocol: UNKNOWN" << std::endl;
            break;
        }
    }

    /**
     * @brief Handle the very low battery event by executing the corresponding battery protocol.
     * 
     * @param ev The very low battery event.
     */
    void battery_low(const EvBatteryLow &) {
        glog.is_warn() && glog << "Battery low!" << std::endl;
        const auto protocol = this->machine().mission_plan().very_low_battery_protocol();
        do_battery_protocol(protocol);
    }

    /**
     * @brief Handle the critically low battery event by executing the corresponding battery protocol.
     * 
     * @param ev The critically low battery event.
     */
    void battery_critical(const EvBatteryCritical &) {
        glog.is_warn() && glog << "Battery critical!" << std::endl;
        const auto protocol = this->machine().mission_plan().critically_low_battery_protocol();
        do_battery_protocol(protocol);
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvReturnToHome, underway::Recovery>,
        boost::statechart::transition<EvRCSetpoint, underway::movement::remotecontrol::Setpoint>,
        boost::statechart::transition<EvPause, pause::Manual>,
        boost::statechart::transition<EvNoForwardProgress, pause::ResolveNoForwardProgress>,

        // Battery events
        boost::statechart::in_state_reaction<EvBatteryLow, Underway, &Underway::battery_low>,
        boost::statechart::in_state_reaction<EvBatteryCritical, Underway,
                                             &Underway::battery_critical>,

        // Battery protocol events
        boost::statechart::transition<EvLowBatteryStationKeep, battery::StationKeep>,
        boost::statechart::transition<EvLowBatteryStopAndBroadcast, battery::StopAndBroadcast>>;
};

namespace underway {

    #include "underway/abort.h"
    #include "underway/movement.h"
    #include "underway/recovery.h"
    #include "underway/task.h"
    #include "underway/replan.h"

} // namespace jaiabot::statechart::inmission::underway

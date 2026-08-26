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

#pragma once

// Boost
#include <boost/statechart/state_machine.hpp>

// Goby
#include <goby/util/seawater.h>

// Mission Manager app
#include "machine_common.h"
#include "states.h"
#include "storm_manager.h"

namespace jaiabot
{
namespace statechart
{

struct StartingUp;

struct StormManagerStateMachine
    : boost::statechart::state_machine<StormManagerStateMachine, StartingUp>,
      AppMethodsAccess<StormManagerStateMachine>
{
    StormManagerStateMachine(apps::StormManager& a, const jaiabot::protobuf::StormMission& mission)
        : app_(a)
    {
        set_mission(mission);
    }

    void set_state(jaiabot::protobuf::StormMissionState state) { state_ = state; }
    jaiabot::protobuf::StormMissionState state() const { return state_; }

    void insert_warning(jaiabot::protobuf::Warning warning) { warnings_.insert(warning); }
    void erase_warning(jaiabot::protobuf::Warning warning) { warnings_.erase(warning); }

    void health(goby::middleware::protobuf::ThreadHealth& health)
    {
        for (auto warning : warnings_)
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)->add_warning(warning);
        if (!warnings_.empty() && health.state() == goby::middleware::protobuf::HEALTH__OK)
            health.set_state(goby::middleware::protobuf::HEALTH__DEGRADED);
    }

    apps::StormManager& app() { return app_; }
    const apps::StormManager& app() const { return app_; }

    void set_mission(const jaiabot::protobuf::StormMission& mission) { mission_ = mission; };
    const jaiabot::protobuf::StormMission& mission() { return mission_; }

    void set_latest_location(const protobuf::GeographicCoordinate& loc) { latest_location_ = loc; };
    const protobuf::GeographicCoordinate& latest_location() { return latest_location_; }

    void mark_launch_tube_recovery_attempted() { launch_tube_recovery_attempted_ = true; }
    bool launch_tube_recovery_attempted() const { return launch_tube_recovery_attempted_; }

    void add_id(protobuf::TaskPacket& task_packet) { task_packet.set_storm_id(task_packet_id_++); }
    std::deque<protobuf::TaskPacket>& task_packet_queue() { return task_packet_queue_; }

    // how often to send requests to the MCU
    constexpr static goby::time::SteadyClock::duration mcu_send_interval()
    {
        return std::chrono::seconds(1);
    }

  private:
    apps::StormManager& app_;
    jaiabot::protobuf::StormMissionState state_{jaiabot::protobuf::STARTING_UP};
    std::set<jaiabot::protobuf::Warning> warnings_;

    jaiabot::protobuf::StormMission mission_;
    protobuf::GeographicCoordinate latest_location_;

    bool launch_tube_recovery_attempted_{false};
    int task_packet_id_{0};
    std::deque<protobuf::TaskPacket> task_packet_queue_;
};

} // namespace statechart
} // namespace jaiabot

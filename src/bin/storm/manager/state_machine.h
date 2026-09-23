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

#include <algorithm>
#include <map>
#include <set>

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

    void set_latest_location(const protobuf::GeographicCoordinate& loc)
    {
        latest_location_ = loc;
        has_latest_location_ = true;
    };
    const protobuf::GeographicCoordinate& latest_location() { return latest_location_; }
    bool has_latest_location() const { return has_latest_location_; }

    void set_gps_connected(bool connected) { gps_connected_ = connected; }
    bool gps_connected() const { return gps_connected_; }

    void set_latest_battery_percent(double percent)
    {
        latest_battery_percent_ = percent;
        has_latest_battery_percent_ = true;
    };
    double latest_battery_percent() const { return latest_battery_percent_; }
    bool has_latest_battery_percent() const { return has_latest_battery_percent_; }

    void mark_launch_tube_recovery_attempted() { launch_tube_recovery_attempted_ = true; }
    bool launch_tube_recovery_attempted() const { return launch_tube_recovery_attempted_; }

    void mark_parachute_attachment_recovery_attempted()
    {
        parachute_attachment_recovery_attempted_ = true;
    }
    bool parachute_attachment_recovery_attempted() const
    {
        return parachute_attachment_recovery_attempted_;
    }

    void add_id(protobuf::TaskPacket& task_packet) { task_packet.set_storm_id(task_packet_id_++); }
    void observe_id(const protobuf::TaskPacket& task_packet)
    {
        if (task_packet.has_storm_id())
            task_packet_id_ = std::max(task_packet_id_, task_packet.storm_id() + 1);
    }
    std::deque<protobuf::TaskPacket>& task_packet_queue() { return task_packet_queue_; }

    // Tracked on the machine rather than per state: a wake runs both
    // SelfTest::AirDescentDataOffload and SleepPrep::DataOffload, and packets published
    // by the first stay in Goby's DynamicBuffer (ttl 3000 s) well after it exits. Per
    // state sets would let the second publish the same storm_ids again, roughly doubling
    // SBD usage for a backlog.
    std::set<int>& task_packets_in_flight() { return task_packets_in_flight_; }
    std::map<int, goby::time::SteadyClock::time_point>& task_packets_deferred_until()
    {
        return task_packets_deferred_until_;
    }

    // how often to send requests to the MCU
    constexpr static goby::time::SteadyClock::duration mcu_send_interval()
    {
        return std::chrono::seconds(1);
    }

    // how long to wait before republishing a TaskPacket that Goby could not buffer
    constexpr static goby::time::SteadyClock::duration task_packet_retry_interval()
    {
        return std::chrono::seconds(30);
    }

    // Publish several TaskPackets at once and let Goby's DynamicBuffer handle
    // retransmission, rather than sending one and waiting for its ack. A single Iridium
    // round trip has been measured at 33-176 s, so a serial send cannot drain a backlog
    // within data_offload_timeout_minutes. Held below the hub-side task_packet_buffer
    // max_queue of 42 so our publications cannot overflow it.
    constexpr static std::size_t max_task_packets_in_flight() { return 8; }

  private:
    apps::StormManager& app_;
    jaiabot::protobuf::StormMissionState state_{jaiabot::protobuf::STARTING_UP};
    std::set<jaiabot::protobuf::Warning> warnings_;

    jaiabot::protobuf::StormMission mission_;
    protobuf::GeographicCoordinate latest_location_;
    bool has_latest_location_{false};
    bool gps_connected_{false};

    double latest_battery_percent_{0};
    bool has_latest_battery_percent_{false};

    bool launch_tube_recovery_attempted_{false};
    bool parachute_attachment_recovery_attempted_{false};
    int task_packet_id_{0};
    std::deque<protobuf::TaskPacket> task_packet_queue_;
    std::set<int> task_packets_in_flight_;
    std::map<int, goby::time::SteadyClock::time_point> task_packets_deferred_until_;
};

} // namespace statechart
} // namespace jaiabot

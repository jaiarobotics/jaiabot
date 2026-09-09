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

#ifndef JAIABOT_BIN_STORM_MANAGER_STORM_MANAGER_H
#define JAIABOT_BIN_STORM_MANAGER_STORM_MANAGER_H

#include <filesystem>

#include <goby/middleware/marshalling/protobuf.h>
// this space intentionally left blank
#include <goby/middleware/io/cobs/serial.h>
#include <goby/zeromq/application/multi_thread.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/units/conductivity.h"
#include "jaiabot/utils/stats.h"

#include "machine_common.h"

namespace jaiabot
{
namespace apps
{
class StormManager : public goby::zeromq::MultiThreadApplication<config::StormManager>
{
  public:
    StormManager();
    ~StormManager();

    // so states can send directly to MCU
    void send_to_mcu(const protobuf::StormMCURequest& request);
    void enqueue_task_packet(protobuf::TaskPacket task_packet);
    void acknowledge_task_packet(const protobuf::TaskPacket& task_packet);

  private:
    void initialize() override;
    void finalize() override;
    void loop() override;
    void health(goby::middleware::protobuf::ThreadHealth& health) override;

    void publish_mission_report(protobuf::StormMissionState state);
    void process_mission_manager_state(protobuf::MissionState state);

    void receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg);
    void handle_command(const protobuf::Command& command);
    void handle_storm_mission_update(const protobuf::StormMissionUpdate& storm_mission_update);
    void load_pending_task_packets();
    std::filesystem::path outbox_dir() const;
    std::filesystem::path task_packet_path(const protobuf::TaskPacket& task_packet) const;

    template <typename Derived> friend class statechart::AppMethodsAccess;

  private:
    std::unique_ptr<statechart::StormManagerStateMachine> machine_;

    utils::RollingStatsAccumulator<boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit>>
        raw_conductivity_;
    utils::RollingStatsAccumulator<boost::units::quantity<boost::units::si::pressure>>
        raw_pressure_;
    utils::RollingStatsAccumulator<boost::units::quantity<boost::units::si::length>> gps_altitude_;
};

} // namespace apps
} // namespace jaiabot

#endif

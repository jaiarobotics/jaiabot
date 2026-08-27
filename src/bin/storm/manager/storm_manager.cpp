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

#include <boost/units/systems/si/frequency.hpp>
#include <algorithm>
#include <cstdlib>
#include <fstream>
namespace si = boost::units::si;
using boost::units::quantity;

#include <goby/middleware/application/multi_thread.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/util/seawater.h>
using goby::glog;
namespace middleware = goby::middleware;

#include "jaiabot/comms/comms.h"
#include "jaiabot/health/health.h"
#include "jaiabot/intervehicle.h"
#include "jaiabot/messages/sensor/pressure_temperature.pb.h"
#include "jaiabot/messages/sensor/salinity.pb.h"
#include "jaiabot/messages/storm_mcu.pb.h"
#include "jaiabot/serial/mcu.h"
#include "states.h"
// intentionally left blank
#include "state_machine.h"
#include "storm_manager.h"

// raw IOData
constexpr goby::middleware::Group mcu_serial_in{"jaiabot::storm::mcu_serial_in"};
constexpr goby::middleware::Group mcu_serial_out{"jaiabot::storm::mcu_serial_out"};

// Main thread
void jaiabot::apps::StormManager::initialize()
{
    machine_.reset(new statechart::StormManagerStateMachine(*this, cfg().initial_mission()));
    load_pending_task_packets();

    machine_->initiate();
}

void jaiabot::apps::StormManager::finalize()
{
    machine_->terminate();
    machine_.reset();
}

jaiabot::apps::StormManager::StormManager()
    : goby::zeromq::MultiThreadApplication<config::StormManager>(1 * si::hertz),
      raw_conductivity_(cfg().rolling_stats_sample_count().conductivity()),
      raw_pressure_(cfg().rolling_stats_sample_count().pressure()),
      gps_altitude_(cfg().rolling_stats_sample_count().gps_altitude())
{
    glog.add_group("statechart", goby::util::Colors::yellow);

    interthread().subscribe<jaiabot::groups::storm::state_change>(
        [this](const jaiabot::protobuf::StormMissionStateChange& state_change)
        {
            const auto& state_name =
                jaiabot::protobuf::StormMissionState_Name(state_change.state());

            if (state_change.direction() == protobuf::StormMissionStateChange::ENTERED)
            {
                glog.is_verbose() && glog << group("statechart") << "Entered: " << state_name
                                          << std::endl;

                // publish the mission report on each state change
                publish_mission_report(state_change.state());
            }
            else
                glog.is_verbose() && glog << group("statechart") << "Exited: " << state_name
                                          << std::endl;
        });

    // trigger events on delegate request
    interprocess().subscribe<jaiabot::groups::state_delegate_request>(
        [this](const jaiabot::protobuf::MissionStateDelegateRequest& req)
        {
            glog.is_debug2() && glog << "Received delegate request: " << req.ShortDebugString()
                                     << std::endl;
            process_mission_manager_state(req.state());
        });

    // also trigger same events on state change
    interprocess().subscribe<jaiabot::groups::state_change>(
        [this](const jaiabot::protobuf::MissionStateChange& change)
        {
            if (change.direction() == jaiabot::protobuf::MissionStateChange::ENTERED)
                process_mission_manager_state(change.state());
        });

    // GPS TPV
    interprocess().subscribe<goby::middleware::groups::gpsd::tpv>(
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv)
        {
            gps_altitude_.push_back(tpv.altitude_with_units());
            machine_->process_event(statechart::EvGPSAltitude(
                gps_altitude_.mean(), gps_altitude_.median(), gps_altitude_.stddev()));
        });

    auto post_conductivity_event =
        [this](boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit> c)
    {
        raw_conductivity_.push_back(c);
        machine_->process_event(statechart::EvConductivity(
            raw_conductivity_.mean(), raw_conductivity_.median(), raw_conductivity_.stddev()));
    };

    // conductivity - currently comes in two different messages
    // TODO - replace with _with_units
    interprocess().subscribe<jaiabot::groups::raw_salinity>(
        [this, post_conductivity_event](const jaiabot::protobuf::SalinityData& sal)
        { post_conductivity_event(sal.conductivity_raw() * jaiabot::units::microsiemens_per_cm); });
    interprocess().subscribe<jaiabot::groups::raw_salinity>(
        [this, post_conductivity_event](const jaiabot::sensor::protobuf::AtlasScientificOEMEC& sal)
        { post_conductivity_event(sal.conductivity_raw() * jaiabot::units::microsiemens_per_cm); });

    // pressure
    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const jaiabot::protobuf::PressureTemperatureData& pt)
        {
            raw_pressure_.push_back(pt.pressure_raw_with_units<quantity<si::pressure>>());
            machine_->process_event(statechart::EvPressure(
                raw_pressure_.mean(), raw_pressure_.median(), raw_pressure_.stddev()));
        });

    // receive data from MCU
    interthread().subscribe<mcu_serial_in>([this](const goby::middleware::protobuf::IOData& io_msg)
                                           { receive_from_mcu(io_msg); });

    using MCUSerialThread =
        goby::middleware::io::SerialThreadCOBS<mcu_serial_in, mcu_serial_out,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD,
                                               goby::middleware::io::PubSubLayer::INTERTHREAD>;

    launch_thread<MCUSerialThread>(cfg().mcu_serial());

    // receive dynamic update command
    interprocess().subscribe<jaiabot::groups::hub_command>([this](const protobuf::Command& command)
                                                           { handle_command(command); });

    // keep track of our own position so we can dive in place
    interprocess().subscribe<jaiabot::groups::bot_status>(
        [this](const protobuf::BotStatus& status)
        {
            if (status.has_location())
                machine_->set_latest_location(status.location());
        });

    // queue up TaskPackets
    interprocess().subscribe<jaiabot::groups::task_packet>(
        [this](const protobuf::TaskPacket& task_packet)
        {
            if (!task_packet.has_storm_id()) // reject our own publications
                enqueue_task_packet(task_packet);
        });
}

jaiabot::apps::StormManager::~StormManager() {}

std::filesystem::path
jaiabot::apps::StormManager::outbox_dir() const
{
    const char* log_dir = std::getenv("jaia_log_dir");
    const char* bot_index = std::getenv("jaia_bot_index");
    const std::filesystem::path root = log_dir ? log_dir : "/var/log/jaiabot";
    const std::string bot = bot_index ? bot_index : std::to_string(cfg().bot_id());
    return root / "bot" / bot / "storm_outbox";
}

std::filesystem::path
jaiabot::apps::StormManager::task_packet_path(const protobuf::TaskPacket& task_packet) const
{
    return outbox_dir() / (std::to_string(task_packet.storm_id()) + ".taskpacket");
}

void jaiabot::apps::StormManager::enqueue_task_packet(protobuf::TaskPacket task_packet)
{
    machine_->add_id(task_packet);

    try
    {
        std::filesystem::create_directories(outbox_dir());
        const auto packet_path = task_packet_path(task_packet);
        const auto temporary_path = packet_path.string() + ".tmp";

        std::ofstream file(temporary_path, std::ios::binary | std::ios::trunc);
        if (!file || !task_packet.SerializeToOstream(&file))
            throw std::runtime_error("failed to write packet");
        file.close();
        std::filesystem::rename(temporary_path, packet_path);

        machine_->task_packet_queue().push_back(std::move(task_packet));
    }
    catch (const std::exception& exception)
    {
        glog.is_warn() && glog << "[iridium] Failed to persist TaskPacket: " << exception.what()
                               << std::endl;
    }
}

void jaiabot::apps::StormManager::acknowledge_task_packet(const protobuf::TaskPacket& task_packet)
{
    std::error_code error;
    std::filesystem::remove(task_packet_path(task_packet), error);
    if (error)
        glog.is_warn() && glog << "[iridium] Failed to remove acknowledged TaskPacket: "
                               << error.message() << std::endl;
}

void jaiabot::apps::StormManager::load_pending_task_packets()
{
    const auto outbox_dir = this->outbox_dir();
    std::error_code error;
    std::filesystem::create_directories(outbox_dir, error);
    if (error)
    {
        glog.is_warn() && glog << "[iridium] Failed to create TaskPacket outbox: "
                               << error.message() << std::endl;
        return;
    }

    std::vector<std::pair<int, std::filesystem::path>> packet_paths;
    for (const auto& entry : std::filesystem::directory_iterator(outbox_dir))
        if (entry.is_regular_file() && entry.path().extension() == ".taskpacket")
        {
            try
            {
                packet_paths.emplace_back(std::stoi(entry.path().stem()), entry.path());
            }
            catch (const std::exception&)
            {
                glog.is_warn() && glog << "[iridium] Ignoring invalid TaskPacket outbox file: "
                                       << entry.path() << std::endl;
            }
        }
    std::sort(packet_paths.begin(), packet_paths.end(),
              [](const auto& left, const auto& right) { return left.first < right.first; });

    for (const auto& [storm_id, packet_path] : packet_paths)
    {
        protobuf::TaskPacket task_packet;
        std::ifstream file(packet_path, std::ios::binary);
        if (!file || !task_packet.ParseFromIstream(&file) || !task_packet.has_storm_id() ||
            task_packet.storm_id() != storm_id)
        {
            glog.is_warn() && glog << "[iridium] Ignoring invalid TaskPacket outbox file: "
                                   << packet_path << std::endl;
            continue;
        }

        machine_->observe_id(task_packet);
        machine_->task_packet_queue().push_back(std::move(task_packet));
    }
}

void jaiabot::apps::StormManager::loop()
{
    publish_mission_report(machine_->state());
    machine_->process_event(statechart::EvLoop());
}

void jaiabot::apps::StormManager::health(goby::middleware::protobuf::ThreadHealth& health)
{
    health.ClearExtension(jaiabot::protobuf::jaiabot_thread);
    health.set_name(this->app_name());
    health.set_state(goby::middleware::protobuf::HEALTH__OK);
    // add warnings that the state machine keeps track of and possible downgrade health state
    machine_->health(health);
}

void jaiabot::apps::StormManager::publish_mission_report(protobuf::StormMissionState state)
{
    auto current_time = goby::time::SteadyClock::now();
    protobuf::StormMissionReport report;
    report.set_state(state);

    interprocess().publish<jaiabot::groups::storm::mission_report>(report);
}

void jaiabot::apps::StormManager::process_mission_manager_state(protobuf::MissionState state)
{
    switch (state)
    {
        case protobuf::PRE_DEPLOYMENT__IDLE:
            machine_->process_event(statechart::EvStarted());
            break;

        case protobuf::PRE_DEPLOYMENT__SELF_TEST:
            machine_->process_event(statechart::EvBeginSelfTest());
            break;

        case protobuf::PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN:
            machine_->process_event(statechart::EvMissionManagerReadyForMission());
            break;

        // A Movement child state is the first state in InMission,
        // but we don't know which one, so choose them all
        case protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT:
        case protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SETPOINT:
        case protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP:
        case protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT:
        case protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRAIL:
            machine_->process_event(statechart::EvMissionRunning());
            break;

        case protobuf::IN_MISSION__UNDERWAY__SLEEP__PREP:
            machine_->process_event(statechart::EvSleepInitiated());
            break;

        default: break;
    }
}

void jaiabot::apps::StormManager::receive_from_mcu(const goby::middleware::protobuf::IOData& io_msg)
{
    glog.is_debug1() && glog << "Received bytes from MCU: " << goby::util::hex_encode(io_msg.data())
                             << std::endl;
    try
    {
        auto mcu_response = jaiabot::serial::decode_from_mcu<protobuf::StormMCUResponse>(io_msg);
        glog.is_verbose() && glog << "Received data from MCU: " << mcu_response.ShortDebugString()
                                  << std::endl;
        // publish for logging
        interprocess().publish<jaiabot::groups::storm::mcu_pb_data_in>(mcu_response);
        // post for state machine
        machine_->process_event(statechart::EvMCUResponse(mcu_response));
    }
    catch (std::exception& e)
    {
        glog.is_warn() && glog << "Failed to decode message from MCU: " << e.what() << std::endl;
    }
}

void jaiabot::apps::StormManager::send_to_mcu(const protobuf::StormMCURequest& request)
{
    glog.is_verbose() && glog << "Send data to MCU: " << request.ShortDebugString() << std::endl;
    auto io_msg = jaiabot::serial::encode_for_mcu(request);
    glog.is_debug1() && glog << "Sending bytes to MCU: " << goby::util::hex_encode(io_msg->data())
                             << std::endl;
    interthread().publish<mcu_serial_out>(io_msg);
}

void jaiabot::apps::StormManager::handle_command(const protobuf::Command& command)
{
    switch (command.type())
    {
        default: break; // handled elsewhere, usually jaiabot_mission_manager
        case protobuf::Command::STORM_DYNAMIC_MISSION_UPDATE:
        {
            if (!command.has_storm())
            {
                glog.is_warn() && glog << "Invalid STORM_DYNAMIC_MISSION_UPDATE: missing "
                                          "command_data field 'storm'"
                                       << std::endl;
                return;
            }
            else
            {
                handle_storm_mission_update(command.storm());
            }
        }
    }
}

void jaiabot::apps::StormManager::handle_storm_mission_update(
    const protobuf::StormMissionUpdate& storm_mission_update)
{
    switch (storm_mission_update.type())
    {
        case protobuf::StormMissionUpdate::UPDATE_MISSION:
            if (!storm_mission_update.has_new_mission())
            {
                glog.is_warn() &&
                    glog << "Invalid STORM_DYNAMIC_MISSION_UPDATE [UPDATE_MISSION]: missing "
                            "update_data field 'new_mission'"
                         << std::endl;
                return;
            }
            else
            {
                glog.is_verbose() && glog << "Set new mission to: "
                                          << storm_mission_update.new_mission().ShortDebugString()
                                          << std::endl;
                machine_->set_mission(storm_mission_update.new_mission());
                machine_->process_event(statechart::EvRemoteMissionReceived());
            }
            break;

        case protobuf::StormMissionUpdate::ABORT:
        case protobuf::StormMissionUpdate::PAUSE:
        case protobuf::StormMissionUpdate::RESUME:
        case protobuf::StormMissionUpdate::DELAY:
            glog.is_warn() &&
                glog << "Invalid STORM_DYNAMIC_MISSION_UPDATE ["
                     << protobuf::StormMissionUpdate::UpdateType_Name(storm_mission_update.type())
                     << "]: Unimplemented" << std::endl;
            break;
    }
}

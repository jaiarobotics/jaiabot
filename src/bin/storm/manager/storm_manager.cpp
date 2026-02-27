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
#include "states.h"
// intentionally left blank
#include "state_machine.h"
#include "storm_manager.h"

// Main thread
void jaiabot::apps::StormManager::initialize()
{
    machine_.reset(new statechart::StormManagerStateMachine(*this));
    machine_->initiate();
}

void jaiabot::apps::StormManager::finalize()
{
    machine_->terminate();
    machine_.reset();
}

jaiabot::apps::StormManager::StormManager()
    : goby::zeromq::MultiThreadApplication<config::StormManager>(1 * si::hertz),
      raw_salinity_(cfg().rolling_stats_sample_count().salinity()),
      raw_pressure_(cfg().rolling_stats_sample_count().pressure())
{
    glog.add_group("statechart", goby::util::Colors::yellow);

    interthread().subscribe<jaiabot::groups::storm_state_change>(
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
        [this](const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv) {});

    // salinity - currently comes in two different messages
    interprocess().subscribe<jaiabot::groups::raw_salinity>(
        [this](const jaiabot::protobuf::SalinityData& sal)
        { raw_salinity_.push_back(sal.salinity() * boost::units::si::si_dimensionless); });
    interprocess().subscribe<jaiabot::groups::raw_salinity>(
        [this](const jaiabot::sensor::protobuf::AtlasScientificOEMEC& sal)
        { raw_salinity_.push_back(sal.salinity() * boost::units::si::si_dimensionless); });

    // pressure
    interprocess().subscribe<jaiabot::groups::pressure_temperature>(
        [this](const jaiabot::protobuf::PressureTemperatureData& pt)
        { raw_pressure_.push_back(pt.pressure_raw_with_units<quantity<si::pressure>>()); });
}

jaiabot::apps::StormManager::~StormManager() {}

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

    interprocess().publish<jaiabot::groups::storm_mission_report>(report);
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

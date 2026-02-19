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

#include <goby/middleware/application/multi_thread.h>
#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/util/seawater.h>
using goby::glog;
namespace middleware = goby::middleware;

#include "jaiabot/comms/comms.h"
#include "jaiabot/health/health.h"
#include "jaiabot/intervehicle.h"

#include "states.h"
#include "storm_manager_state_machine.h"
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
    : goby::zeromq::MultiThreadApplication<config::StormManager>(1 * si::hertz)
{
    glog.add_group("statechart", goby::util::Colors::yellow);
}

jaiabot::apps::StormManager::~StormManager()
{

}

void jaiabot::apps::StormManager::loop()
{
//    publish_mission_report(machine_->state());
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

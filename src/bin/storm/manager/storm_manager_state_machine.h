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
#include "storm_manager.h"
#include "states.h"

namespace jaiabot
{
namespace statechart
{

struct StartingUp;

struct StormManagerStateMachine
    : boost::statechart::state_machine<StormManagerStateMachine, StartingUp>,
      AppMethodsAccess<StormManagerStateMachine>
{
    StormManagerStateMachine(apps::StormManager& a) : app_(a) {}

    void set_state(jaiabot::protobuf::StormState state) { state_ = state; }
    jaiabot::protobuf::StormState state() const { return state_; }

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

    bool has_geodesy() const { return geodesy_ ? true : false; }
    goby::util::UTMGeodesy& geodesy()
    {
        if (has_geodesy())
            return *geodesy_;
        else
            throw(goby::Exception("Uninitialized geodesy"));
    }

  private:
    apps::StormManager& app_;
    jaiabot::protobuf::StormState state_{jaiabot::protobuf::STARTING_UP};
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;
    std::set<jaiabot::protobuf::Warning> warnings_;
};

} // namespace statechart
} // namespace jaiabot

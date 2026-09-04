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

// Goby
#include <goby/zeromq/application/multi_thread.h>

// Jaiabot
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/storm.pb.h"

namespace jaiabot
{

namespace apps
{
class StormManager;
}

namespace config
{
class StormManager;
}

namespace statechart
{
struct StormManagerStateMachine;

// provides access to parent App's methods (e.g. interthread() and interprocess()) from within the states' structs
template <typename Derived> class AppMethodsAccess
{
  protected:
    goby::middleware::InterVehicleForwarder<
        goby::zeromq::InterProcessPortal<goby::middleware::InterThreadTransporter>>&
    intervehicle()
    {
        return app().intervehicle();
    }

    goby::zeromq::InterProcessPortal<goby::middleware::InterThreadTransporter>& interprocess()
    {
        return app().interprocess();
    }

    goby::middleware::InterThreadTransporter& interthread() { return app().interthread(); }

    const config::StormManager& cfg() const { return this->app().cfg(); }

    StormManagerStateMachine& machine() { return static_cast<Derived*>(this)->outermost_context(); }

    const StormManagerStateMachine& machine() const
    {
        return static_cast<const Derived*>(this)->outermost_context();
    }

    apps::StormManager& app() { return machine().app(); }
    const apps::StormManager& app() const { return machine().app(); }
};

// RAII publication of state changes
template <typename Derived, protobuf::StormMissionState state>
struct Notify : public AppMethodsAccess<Derived>
{
    Notify()
    {
        this->machine().set_state(state);

        goby::middleware::protobuf::TransporterConfig pub_cfg;
        // required since we're publishing in and subscribing to the group within the same thread
        pub_cfg.set_echo(true);

        protobuf::StormMissionStateChange state_change;
        state_change.set_state(state);
        state_change.set_direction(protobuf::StormMissionStateChange::ENTERED);
        this->interprocess().template publish<groups::storm::state_change>(state_change, {pub_cfg});
    }
    ~Notify()
    {
        goby::middleware::protobuf::TransporterConfig pub_cfg;
        pub_cfg.set_echo(true);
        protobuf::StormMissionStateChange state_change;
        state_change.set_state(state);
        state_change.set_direction(protobuf::StormMissionStateChange::EXITED);
        this->interprocess().template publish<groups::storm::state_change>(state_change, {pub_cfg});
    }
};

} // namespace statechart
} // namespace jaiabot

namespace jaiabot::protobuf
{
inline bool operator==(const TaskPacket& lhs, const TaskPacket& rhs)
{
    // consider packets without ID to never be equal
    if (!lhs.has_storm_id() || !rhs.has_storm_id())
        return false;
    else
        return lhs.storm_id() == rhs.storm_id();
}
} // namespace jaiabot::protobuf

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

#ifndef JAIABOT_SRC_BIN_MISSION_MANAGER_MACHINE_COMMON_H
#define JAIABOT_SRC_BIN_MISSION_MANAGER_MACHINE_COMMON_H

// Goby
#include <goby/zeromq/application/multi_thread.h>

// Jaiabot
#include "jaiabot/groups.h"
#include "jaiabot/messages/jaia_dccl.pb.h"

namespace jaiabot
{

namespace apps
{
class MissionManager;
}

namespace config
{
class MissionManager;
}

namespace statechart
{
struct MissionManagerStateMachine;

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

    const config::MissionManager& cfg() const { return this->app().cfg(); }

    MissionManagerStateMachine& machine()
    {
        return static_cast<Derived*>(this)->outermost_context();
    }

    const MissionManagerStateMachine& machine() const
    {
        return static_cast<const Derived*>(this)->outermost_context();
    }

    apps::MissionManager& app() { return machine().app(); }
    const apps::MissionManager& app() const { return machine().app(); }
};

// RAII publication of state changes
template <typename Derived, protobuf::MissionState state,
          protobuf::SetpointType setpoint_type = protobuf::SETPOINT_STOP,
          protobuf::DelegateType delegate_type = protobuf::NOT_DELEGATED>
struct Notify : public AppMethodsAccess<Derived>
{
    Notify()
    {
        this->machine().set_state(state);
        this->machine().set_setpoint_type(setpoint_type);

        goby::middleware::protobuf::TransporterConfig pub_cfg;
        // required since we're publishing in and subscribing to the group within the same thread
        pub_cfg.set_echo(true);

        protobuf::MissionStateChange state_change;
        state_change.set_state(state);
        state_change.set_direction(protobuf::MissionStateChange::ENTERED);
        this->interprocess().template publish<groups::state_change>(state_change, {pub_cfg});

        if (delegate_type == protobuf::CAN_BE_DELEGATED)
        {
            protobuf::MissionStateDelegateRequest req;
            req.set_state(state);
            this->interprocess().template publish<groups::state_delegate_request>(req);
        }
    }
    ~Notify()
    {
        goby::middleware::protobuf::TransporterConfig pub_cfg;
        pub_cfg.set_echo(true);
        protobuf::MissionStateChange state_change;
        state_change.set_state(state);
        state_change.set_direction(protobuf::MissionStateChange::EXITED);
        this->interprocess().template publish<groups::state_change>(state_change, {pub_cfg});
    }
};

} // namespace statechart
} // namespace jaiabot

#endif

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
          protobuf::SetpointType setpoint_type = protobuf::SETPOINT_STOP>
struct Notify : public AppMethodsAccess<Derived>
{
    Notify()
    {
        this->machine().set_state(state);
        this->machine().set_setpoint_type(setpoint_type);

        goby::middleware::protobuf::TransporterConfig pub_cfg;
        // required since we're publishing in and subscribing to the group within the same thread
        pub_cfg.set_echo(true);
        this->interthread().template publish<groups::state_change>(std::make_pair(true, state),
                                                                   {pub_cfg});
    }
    ~Notify()
    {
        goby::middleware::protobuf::TransporterConfig pub_cfg;
        pub_cfg.set_echo(true);
        this->interthread().template publish<groups::state_change>(std::make_pair(false, state),
                                                                   {pub_cfg});
    }
};

} // namespace statechart
} // namespace jaiabot

#endif

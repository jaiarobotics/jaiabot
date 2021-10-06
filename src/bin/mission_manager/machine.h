#ifndef JAIABOT_SRC_BIN_MISSION_MANAGER_MACHINE_H
#define JAIABOT_SRC_BIN_MISSION_MANAGER_MACHINE_H

#include <boost/mpl/list.hpp>
#include <boost/statechart/event.hpp>
#include <boost/statechart/state.hpp>
#include <boost/statechart/state_machine.hpp>
#include <boost/statechart/transition.hpp>

#include <goby/util/debug_logger.h>
#include <goby/util/linebasedcomms/nmea_sentence.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/mission.pb.h"

namespace jaiabot
{
namespace groups
{
constexpr goby::middleware::Group state_change{"jaiabot::state_change"};
} // namespace groups

namespace apps
{
class MissionManager;
}

namespace statechart
{
struct MissionManagerStateMachine;

// events
#define STATECHART_EVENT(EVENT)                    \
    struct EVENT : boost::statechart::event<EVENT> \
    {                                              \
    };

// events
STATECHART_EVENT(EvTurnOn)
#undef STATECHART_EVENT

// provides access to parent App's methods (e.g. interthread() and interprocess()) from within the states' structs
template <typename Derived> class AppMethodsAccess
{
  protected:
    goby::zeromq::InterProcessPortal<goby::middleware::InterThreadTransporter>& interprocess()
    {
        return app().interprocess();
    }

    goby::middleware::InterThreadTransporter& interthread() { return app().interthread(); }

    const apps::MissionManager& app() const
    {
        return static_cast<const Derived*>(this)->outermost_context().app();
    }

    MissionManagerStateMachine& machine()
    {
        return static_cast<Derived*>(this)->outermost_context();
    }
    apps::MissionManager& app() { return machine().app(); }
};

// RAII publication of state changes
template <typename Derived, jaiabot::protobuf::MissionState state>
struct Notify : public AppMethodsAccess<Derived>
{
    Notify()
    {
        this->machine().set_state(state);

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

struct PreDeployment;
namespace predeployment
{
struct Off;
struct SelfTest;
struct Failed;
struct Configuring;
struct Ready;
} // namespace predeployment

struct Underway;
namespace underway
{
struct Launch;
namespace launch
{
struct StationKeep;
}
struct Waypoints;
namespace waypoints
{
struct Transit;
struct Dive;
} // namespace waypoints
struct Recovery;
namespace recovery
{
struct Transit;
struct StationKeep;
struct Stopped;
} // namespace recovery
struct Abort;

} // namespace underway

struct PostDeployment;
namespace postdeployment
{
struct Recovered;
struct DataProcessing;
struct DataOffload;
struct Shutdown;

} // namespace postdeployment

struct MissionManagerStateMachine
    : boost::statechart::state_machine<MissionManagerStateMachine, PreDeployment>
{
    MissionManagerStateMachine(apps::MissionManager& a) : app_(a) {}

    void set_state(jaiabot::protobuf::MissionState state) { state_ = state; }
    jaiabot::protobuf::MissionState state() { return state_; }
    apps::MissionManager& app() { return app_; }

  private:
    apps::MissionManager& app_;
    jaiabot::protobuf::MissionState state_{jaiabot::protobuf::PRE_DEPLOYMENT__OFF};
};

struct PreDeployment
    : boost::statechart::state<PreDeployment,              // (CRTP)
                               MissionManagerStateMachine, // Parent state (or machine)
                               predeployment::Off          // Child substate
                               >
{
    using StateBase =
        boost::statechart::state<PreDeployment, MissionManagerStateMachine, predeployment::Off>;

    // entry action
    PreDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PreDeployment() {}
};

namespace predeployment
{
struct Off : boost::statechart::state<Off, PreDeployment>,
             Notify<Off, protobuf::PRE_DEPLOYMENT__OFF>
{
    using StateBase = boost::statechart::state<Off, PreDeployment>;
    Off(typename StateBase::my_context c) : StateBase(c) {}
    ~Off() {}
};

} // namespace predeployment

} // namespace statechart
} // namespace jaiabot
#endif

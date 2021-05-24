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

namespace jaiabot
{
namespace groups
{
constexpr goby::middleware::Group state_entry{"state_entry"};
constexpr goby::middleware::Group state_exit{"state_exit"};
} // namespace groups

namespace apps
{
class MissionManager;
}

namespace statechart
{
struct MissionManagerStateMachine;

struct Launch;
namespace launch
{
struct StationKeep;
}

struct Underway;
namespace underway
{
struct HelmControl;
struct Profile;
} // namespace underway

struct Recover;
namespace recover
{
struct StationKeep;
struct Stopped;
} // namespace recover

// events
struct EvCommenceMission : boost::statechart::event<EvCommenceMission>
{
};

template <typename State> void publish_entry(State& state, const std::string& name)
{
    auto& interthread = state.outermost_context().app.interthread();

    goby::middleware::protobuf::TransporterConfig pub_cfg;
    // required since we're publishing in and subscribing to the group within the same thread
    pub_cfg.set_echo(true);
    interthread.template publish<groups::state_entry>(name, {pub_cfg});
}

template <typename State> void publish_exit(State& state, const std::string& name)
{
    auto& interthread = state.outermost_context().app.interthread();
    goby::middleware::protobuf::TransporterConfig pub_cfg;
    pub_cfg.set_echo(true);
    interthread.template publish<groups::state_exit>(name, {pub_cfg});
}

struct MissionManagerStateMachine
    : boost::statechart::state_machine<MissionManagerStateMachine, Launch>
{
    MissionManagerStateMachine(apps::MissionManager& a) : app(a) {}
    apps::MissionManager& app;
};

struct Launch : boost::statechart::state<Launch,                     // (CRTP)
                                         MissionManagerStateMachine, // Parent state (or machine)
                                         launch::StationKeep         // Child substate
                                         >
{
    using StateBase =
        boost::statechart::state<Launch, MissionManagerStateMachine, launch::StationKeep>;

    // entry action
    Launch(typename StateBase::my_context c) : StateBase(c) { publish_entry(*this, "Launch"); }

    // exit action
    ~Launch() { publish_exit(*this, "Launch"); }

    // can have multiple reactions in a list
    typedef boost::mpl::list<boost::statechart::transition<EvCommenceMission, Underway>> reactions;
};

namespace launch
{
struct StationKeep : boost::statechart::state<StationKeep, // (CRTP)
                                              Launch       // Parent state (or machine)
                                              >
{
    using StateBase = boost::statechart::state<StationKeep, Launch>;

    // entry action
    StationKeep(typename StateBase::my_context c) : StateBase(c)
    {
        publish_entry(*this, "StationKeep");
    }

    // exit action
    ~StationKeep() { publish_exit(*this, "StationKeep"); }
};
} // namespace launch

struct Underway
    : boost::statechart::state<Underway, MissionManagerStateMachine, underway::HelmControl>
{
    using StateBase =
        boost::statechart::state<Underway, MissionManagerStateMachine, underway::HelmControl>;

    // entry action
    Underway(typename StateBase::my_context c) : StateBase(c) { publish_entry(*this, "Underway"); }

    // exit action
    ~Underway() { publish_exit(*this, "Underway"); }
};

namespace underway
{
struct HelmControl : boost::statechart::state<HelmControl, // (CRTP)
                                              Underway     // Parent state (or machine)
                                              >
{
    using StateBase = boost::statechart::state<HelmControl, Underway>;

    // entry action
    HelmControl(typename StateBase::my_context c) : StateBase(c)
    {
        publish_entry(*this, "HelmControl");
    }

    // exit action
    ~HelmControl() { publish_exit(*this, "HelmControl"); }
};
} // namespace underway

} // namespace statechart
} // namespace jaiabot
#endif

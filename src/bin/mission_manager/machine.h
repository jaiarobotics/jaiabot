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
struct WaitForMissionPlan;
struct Ready;
} // namespace predeployment

struct Underway;
namespace underway
{
struct Movement;
namespace movement
{
struct Transit;
struct RemoteControl;
} // namespace movement

struct Task;
namespace task
{
struct StationKeep;
struct SurfaceDrift;
struct Dive;
namespace dive
{
struct PoweredDescent;
struct Hold;
struct UnpoweredAscent;
struct PoweredAscent;
} // namespace dive
} // namespace task

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
struct Idle;
struct ShuttingDown;

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
                               predeployment::Off          // Initial child substate
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

struct SelfTest : boost::statechart::state<SelfTest, PreDeployment>,
                  Notify<SelfTest, protobuf::PRE_DEPLOYMENT__SELF_TEST>
{
    using StateBase = boost::statechart::state<SelfTest, PreDeployment>;
    SelfTest(typename StateBase::my_context c) : StateBase(c) {}
    ~SelfTest() {}
};

struct Failed : boost::statechart::state<Failed, PreDeployment>,
                Notify<Failed, protobuf::PRE_DEPLOYMENT__FAILED>
{
    using StateBase = boost::statechart::state<Failed, PreDeployment>;
    Failed(typename StateBase::my_context c) : StateBase(c) {}
    ~Failed() {}
};

struct WaitForMissionPlan
    : boost::statechart::state<WaitForMissionPlan, PreDeployment>,
      Notify<WaitForMissionPlan, protobuf::PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN>
{
    using StateBase = boost::statechart::state<WaitForMissionPlan, PreDeployment>;
    WaitForMissionPlan(typename StateBase::my_context c) : StateBase(c) {}
    ~WaitForMissionPlan() {}
};

struct Ready : boost::statechart::state<Ready, PreDeployment>,
               Notify<Ready, protobuf::PRE_DEPLOYMENT__READY>
{
    using StateBase = boost::statechart::state<Ready, PreDeployment>;
    Ready(typename StateBase::my_context c) : StateBase(c) {}
    ~Ready() {}
};

} // namespace predeployment

struct Underway : boost::statechart::state<Underway, MissionManagerStateMachine, underway::Movement>
{
    using StateBase =
        boost::statechart::state<Underway, MissionManagerStateMachine, underway::Movement>;

    Underway(typename StateBase::my_context c) : StateBase(c) {}
    ~Underway() {}
};

namespace underway
{

struct Movement : boost::statechart::state<Movement, Underway, movement::Transit>
{
    using StateBase = boost::statechart::state<Movement, Underway, movement::Transit>;

    Movement(typename StateBase::my_context c) : StateBase(c) {}
    ~Movement() {}
};

namespace movement
{
struct Transit : boost::statechart::state<Transit, Movement>,
                 Notify<Transit, protobuf::UNDERWAY__MOVEMENT__TRANSIT>
{
    using StateBase = boost::statechart::state<Transit, Movement>;
    Transit(typename StateBase::my_context c) : StateBase(c) {}
    ~Transit() {}
};

struct RemoteControl : boost::statechart::state<RemoteControl, Movement>,
                       Notify<RemoteControl, protobuf::UNDERWAY__MOVEMENT__REMOTE_CONTROL>
{
    using StateBase = boost::statechart::state<RemoteControl, Movement>;
    RemoteControl(typename StateBase::my_context c) : StateBase(c) {}
    ~RemoteControl() {}
};

} // namespace movement

struct Task : boost::statechart::state<Task, Underway, task::StationKeep>
{
    using StateBase = boost::statechart::state<Task, Underway, task::StationKeep>;

    Task(typename StateBase::my_context c) : StateBase(c) {}
    ~Task() {}
};

namespace task
{
struct StationKeep : boost::statechart::state<StationKeep, Task>,
                     Notify<StationKeep, protobuf::UNDERWAY__TASK__STATION_KEEP>
{
    using StateBase = boost::statechart::state<StationKeep, Task>;
    StationKeep(typename StateBase::my_context c) : StateBase(c) {}
    ~StationKeep() {}
};
struct SurfaceDrift : boost::statechart::state<SurfaceDrift, Task>,
                      Notify<SurfaceDrift, protobuf::UNDERWAY__TASK__SURFACE_DRIFT>
{
    using StateBase = boost::statechart::state<SurfaceDrift, Task>;
    SurfaceDrift(typename StateBase::my_context c) : StateBase(c) {}
    ~SurfaceDrift() {}
};

struct Dive : boost::statechart::state<Dive, Task, dive::PoweredDescent>
{
    using StateBase = boost::statechart::state<Dive, Task, dive::PoweredDescent>;

    Dive(typename StateBase::my_context c) : StateBase(c) {}
    ~Dive() {}
};
namespace dive
{
struct PoweredDescent : boost::statechart::state<PoweredDescent, Dive>,
                        Notify<PoweredDescent, protobuf::UNDERWAY__TASK__DIVE__POWERED_DESCENT>
{
    using StateBase = boost::statechart::state<PoweredDescent, Dive>;
    PoweredDescent(typename StateBase::my_context c) : StateBase(c) {}
    ~PoweredDescent() {}
};

struct Hold : boost::statechart::state<Hold, Dive>,
              Notify<Hold, protobuf::UNDERWAY__TASK__DIVE__HOLD>
{
    using StateBase = boost::statechart::state<Hold, Dive>;
    Hold(typename StateBase::my_context c) : StateBase(c) {}
    ~Hold() {}
};

struct UnpoweredAscent : boost::statechart::state<UnpoweredAscent, Dive>,
                         Notify<UnpoweredAscent, protobuf::UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT>
{
    using StateBase = boost::statechart::state<UnpoweredAscent, Dive>;
    UnpoweredAscent(typename StateBase::my_context c) : StateBase(c) {}
    ~UnpoweredAscent() {}
};

struct PoweredAscent : boost::statechart::state<PoweredAscent, Dive>,
                       Notify<PoweredAscent, protobuf::UNDERWAY__TASK__DIVE__POWERED_ASCENT>
{
    using StateBase = boost::statechart::state<PoweredAscent, Dive>;
    PoweredAscent(typename StateBase::my_context c) : StateBase(c) {}
    ~PoweredAscent() {}
};

} // namespace dive
} // namespace task

struct Recovery : boost::statechart::state<Recovery, Underway, recovery::Transit>
{
    using StateBase = boost::statechart::state<Recovery, Underway, recovery::Transit>;

    Recovery(typename StateBase::my_context c) : StateBase(c) {}
    ~Recovery() {}
};

namespace recovery
{
struct Transit : boost::statechart::state<Transit, Recovery>,
                 Notify<Transit, protobuf::UNDERWAY__RECOVERY__TRANSIT>
{
    using StateBase = boost::statechart::state<Transit, Recovery>;
    Transit(typename StateBase::my_context c) : StateBase(c) {}
    ~Transit() {}
};

struct StationKeep : boost::statechart::state<StationKeep, Recovery>,
                     Notify<StationKeep, protobuf::UNDERWAY__RECOVERY__STATION_KEEP>
{
    using StateBase = boost::statechart::state<StationKeep, Recovery>;
    StationKeep(typename StateBase::my_context c) : StateBase(c) {}
    ~StationKeep() {}
};

struct Stopped : boost::statechart::state<Stopped, Recovery>,
                 Notify<Stopped, protobuf::UNDERWAY__RECOVERY__STOPPED>
{
    using StateBase = boost::statechart::state<Stopped, Recovery>;
    Stopped(typename StateBase::my_context c) : StateBase(c) {}
    ~Stopped() {}
};
} // namespace recovery

struct Abort : boost::statechart::state<Abort, Underway>, Notify<Abort, protobuf::UNDERWAY__ABORT>
{
    using StateBase = boost::statechart::state<Abort, Underway>;
    Abort(typename StateBase::my_context c) : StateBase(c) {}
    ~Abort() {}
};

} // namespace underway

struct PostDeployment : boost::statechart::state<PostDeployment, MissionManagerStateMachine,
                                                 postdeployment::Recovered>
{
    using StateBase = boost::statechart::state<PostDeployment, MissionManagerStateMachine,
                                               postdeployment::Recovered>;

    // entry action
    PostDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PostDeployment() {}
};

namespace postdeployment
{
struct Recovered : boost::statechart::state<Recovered, PostDeployment>,
                   Notify<Recovered, protobuf::POST_DEPLOYMENT__RECOVERED>
{
    using StateBase = boost::statechart::state<Recovered, PostDeployment>;
    Recovered(typename StateBase::my_context c) : StateBase(c) {}
    ~Recovered() {}
};

struct DataProcessing : boost::statechart::state<DataProcessing, PostDeployment>,
                        Notify<DataProcessing, protobuf::POST_DEPLOYMENT__DATA_PROCESSING>
{
    using StateBase = boost::statechart::state<DataProcessing, PostDeployment>;
    DataProcessing(typename StateBase::my_context c) : StateBase(c) {}
    ~DataProcessing() {}
};

struct DataOffload : boost::statechart::state<DataOffload, PostDeployment>,
                     Notify<DataOffload, protobuf::POST_DEPLOYMENT__DATA_OFFLOAD>
{
    using StateBase = boost::statechart::state<DataOffload, PostDeployment>;
    DataOffload(typename StateBase::my_context c) : StateBase(c) {}
    ~DataOffload() {}
};

struct ShuttingDown : boost::statechart::state<ShuttingDown, PostDeployment>,
                      Notify<ShuttingDown, protobuf::POST_DEPLOYMENT__SHUTTING_DOWN>
{
    using StateBase = boost::statechart::state<ShuttingDown, PostDeployment>;
    ShuttingDown(typename StateBase::my_context c) : StateBase(c) {}
    ~ShuttingDown() {}
};

} // namespace postdeployment

} // namespace statechart
} // namespace jaiabot
#endif

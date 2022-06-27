#ifndef JAIABOT_SRC_BIN_MISSION_MANAGER_MACHINE_H
#define JAIABOT_SRC_BIN_MISSION_MANAGER_MACHINE_H

#include <boost/mpl/list.hpp>
#include <boost/statechart/custom_reaction.hpp>
#include <boost/statechart/deep_history.hpp>
#include <boost/statechart/event.hpp>
#include <boost/statechart/in_state_reaction.hpp>
#include <boost/statechart/state.hpp>
#include <boost/statechart/state_machine.hpp>
#include <boost/statechart/transition.hpp>

#include "goby/middleware/navigation/navigation.h"
#include <goby/util/debug_logger.h>
#include <goby/util/linebasedcomms/nmea_sentence.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/mission.pb.h"
#include "machine_common.h"

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
STATECHART_EVENT(EvSelfTestSuccessful)
STATECHART_EVENT(EvSelfTestFails)
struct EvMissionFeasible : boost::statechart::event<EvMissionFeasible>
{
    EvMissionFeasible(const jaiabot::protobuf::MissionPlan& p) : plan(p) {}
    jaiabot::protobuf::MissionPlan plan;
};

STATECHART_EVENT(EvMissionInfeasible)
STATECHART_EVENT(EvDeployed)
STATECHART_EVENT(EvWaypointReached)

struct EvPerformTask : boost::statechart::event<EvPerformTask>
{
    EvPerformTask() : has_task(false) {}
    EvPerformTask(const jaiabot::protobuf::MissionTask& t) : task(t), has_task(true) {}
    bool has_task;
    jaiabot::protobuf::MissionTask task;
}; // namespace statechart

STATECHART_EVENT(EvTaskComplete)
STATECHART_EVENT(EvNewMission)
STATECHART_EVENT(EvReturnToHome)
STATECHART_EVENT(EvStop)
STATECHART_EVENT(EvAbort)
STATECHART_EVENT(EvRecovered)
STATECHART_EVENT(EvBeginDataProcessing)
STATECHART_EVENT(EvDataProcessingComplete)
STATECHART_EVENT(EvDataOffloadComplete)
STATECHART_EVENT(EvShutdown)
STATECHART_EVENT(EvRedeploy)
STATECHART_EVENT(EvDepthTargetReached)
STATECHART_EVENT(EvDiveComplete)
STATECHART_EVENT(EvHoldComplete)
STATECHART_EVENT(EvSurfacingTimeout)

STATECHART_EVENT(EvLoop)
struct EvVehicleDepth : boost::statechart::event<EvVehicleDepth>
{
    EvVehicleDepth(boost::units::quantity<boost::units::si::length> d) : depth(d) {}
    boost::units::quantity<boost::units::si::length> depth;
};
struct EvMeasurement : boost::statechart::event<EvMeasurement>
{
    boost::optional<
        boost::units::quantity<boost::units::absolute<boost::units::celsius::temperature>>>
        temperature;
    boost::optional<double> salinity;
};

STATECHART_EVENT(EvResumeMovement)
struct EvRCSetpoint : boost::statechart::event<EvRCSetpoint>
{
    EvRCSetpoint(const protobuf::RemoteControl& setpoint) : rc_setpoint(setpoint) {}
    protobuf::RemoteControl rc_setpoint;
};
STATECHART_EVENT(EvRCSetpointComplete)

#undef STATECHART_EVENT

// RAII publication of state changes
template <typename Derived, jaiabot::protobuf::MissionState state,
          jaiabot::protobuf::SetpointType setpoint_type = protobuf::SETPOINT_STOP>
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

struct PreDeployment;
namespace predeployment
{
struct Off;
struct SelfTest;
struct Failed;
struct WaitForMissionPlan;
struct Ready;
} // namespace predeployment

struct InMission;
namespace inmission
{
struct Underway;
namespace underway
{
struct Replan;
struct Movement;
namespace movement
{
// dummy state whose role is to dynmically transit to the correct substate
// based on the current mission
struct MovementSelection;

struct Transit;
struct RemoteControl;
namespace remotecontrol
{
struct RemoteControlEndSelection;
struct StationKeep;
struct SurfaceDrift;
struct Setpoint;
} // namespace remotecontrol

} // namespace movement

struct Task;
namespace task
{
struct TaskSelection;

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
} // namespace inmission

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
    : boost::statechart::state_machine<MissionManagerStateMachine, PreDeployment>,
      AppMethodsAccess<MissionManagerStateMachine>
{
    MissionManagerStateMachine(apps::MissionManager& a) : app_(a) {}

    void set_state(jaiabot::protobuf::MissionState state) { state_ = state; }
    jaiabot::protobuf::MissionState state() const { return state_; }

    void set_setpoint_type(jaiabot::protobuf::SetpointType setpoint_type)
    {
        setpoint_type_ = setpoint_type;
    }
    jaiabot::protobuf::SetpointType setpoint_type() const { return setpoint_type_; }

    apps::MissionManager& app() { return app_; }
    const apps::MissionManager& app() const { return app_; }

    void set_mission_plan(const jaiabot::protobuf::MissionPlan& plan, bool reset_datum)
    {
        plan_ = plan;
        goby::glog.is_debug1() && goby::glog << "Set new mission plan." << std::endl;

        if (reset_datum)
        {
            // use recovery location for datum
            auto lat_origin = plan.recovery().recover_at_final_goal()
                                  ? plan.goal(plan.goal_size() - 1).location().lat_with_units()
                                  : plan.recovery().location().lat_with_units();
            auto lon_origin = plan.recovery().recover_at_final_goal()
                                  ? plan.goal(plan.goal_size() - 1).location().lon_with_units()
                                  : plan.recovery().location().lon_with_units();

            // set the local datum origin to the first goal
            goby::middleware::protobuf::DatumUpdate update;
            update.mutable_datum()->set_lat_with_units(lat_origin);
            update.mutable_datum()->set_lon_with_units(lon_origin);
            this->interprocess().template publish<goby::middleware::groups::datum_update>(update);
            geodesy_.reset(new goby::util::UTMGeodesy({lat_origin, lon_origin}));

            goby::glog.is_debug1() &&
                goby::glog << "Updated datum to: " << update.ShortDebugString() << std::endl;
        }
    }
    const jaiabot::protobuf::MissionPlan& mission_plan() const { return plan_; }

    bool has_geodesy() const { return geodesy_ ? true : false; }
    goby::util::UTMGeodesy& geodesy()
    {
        if (has_geodesy())
            return *geodesy_;
        else
            throw(goby::Exception("Uninitialized geodesy"));
    }

  private:
    apps::MissionManager& app_;
    jaiabot::protobuf::MissionState state_{jaiabot::protobuf::PRE_DEPLOYMENT__OFF};
    jaiabot::protobuf::MissionPlan plan_;
    jaiabot::protobuf::SetpointType setpoint_type_{jaiabot::protobuf::SETPOINT_STOP};
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;
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

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, postdeployment::ShuttingDown>>;
};

namespace predeployment
{
struct Off : boost::statechart::state<Off, PreDeployment>,
             Notify<Off, protobuf::PRE_DEPLOYMENT__OFF>
{
    using StateBase = boost::statechart::state<Off, PreDeployment>;
    Off(typename StateBase::my_context c) : StateBase(c) {}
    ~Off() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvTurnOn, SelfTest>>;
};

struct SelfTest : boost::statechart::state<SelfTest, PreDeployment>,
                  Notify<SelfTest, protobuf::PRE_DEPLOYMENT__SELF_TEST>
{
    using StateBase = boost::statechart::state<SelfTest, PreDeployment>;
    SelfTest(typename StateBase::my_context c) : StateBase(c) {}
    ~SelfTest() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvSelfTestFails, Failed>,
                         boost::statechart::transition<EvSelfTestSuccessful, WaitForMissionPlan>>;
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

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvMissionFeasible, Ready>,
        boost::statechart::transition<EvMissionInfeasible,
                                      WaitForMissionPlan> // maybe change to in_state_reaction?
        >;
};

struct Ready : boost::statechart::state<Ready, PreDeployment>,
               Notify<Ready, protobuf::PRE_DEPLOYMENT__READY>
{
    using StateBase = boost::statechart::state<Ready, PreDeployment>;
    Ready(typename StateBase::my_context c) : StateBase(c)
    {
        auto mission_feasible_event = dynamic_cast<const EvMissionFeasible*>(triggering_event());
        if (mission_feasible_event)
        {
            const auto plan = mission_feasible_event->plan;
            this->machine().set_mission_plan(plan, true); // reset the datum on the initial mission
            if (plan.start() == protobuf::MissionPlan::START_IMMEDIATELY)
                post_event(EvDeployed());
        }
    }
    ~Ready() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvDeployed, InMission>>;
};

} // namespace predeployment

struct InMission
    : boost::statechart::state<InMission, MissionManagerStateMachine, inmission::Underway>,
      AppMethodsAccess<InMission>
{
    constexpr static int RECOVERY_GOAL_INDEX{-1};

    using StateBase =
        boost::statechart::state<InMission, MissionManagerStateMachine, inmission::Underway>;

    InMission(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "InMission" << std::endl;
    }
    ~InMission() { goby::glog.is_debug1() && goby::glog << "~InMission" << std::endl; }

    int goal_index() const { return goal_index_; }

    boost::optional<protobuf::MissionPlan::Goal> current_goal() const
    {
        if (goal_index() >= this->machine().mission_plan().goal_size() ||
            goal_index() == RECOVERY_GOAL_INDEX)
            return boost::none;
        else
            return boost::optional<protobuf::MissionPlan::Goal>(
                this->machine().mission_plan().goal(goal_index()));
    }

    protobuf::MissionPlan::Goal final_goal() const
    {
        const auto& mission_plan = this->machine().mission_plan();
        return mission_plan.goal(mission_plan.goal_size() - 1);
    }

    boost::optional<protobuf::MissionTask> current_planned_task() const
    {
        if (mission_complete_)
            return boost::none;

        const auto& plan = this->machine().mission_plan();
        if (!plan.goal(goal_index()).has_task())
            return boost::none;
        else
            return boost::optional<protobuf::MissionTask>(plan.goal(goal_index()).task());
    }

    void increment_goal_index()
    {
        ++goal_index_;
        // all goals completed
        if (goal_index_ >= this->machine().mission_plan().goal_size())
        {
            goby::glog.is_verbose() && goby::glog << group("movement")
                                                  << "All goals complete, mission is complete."
                                                  << std::endl;

            set_mission_complete();
            goal_index_ = RECOVERY_GOAL_INDEX;
        }
    }

    void set_mission_complete() { mission_complete_ = true; }

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvNewMission, inmission::underway::Replan>>;

  private:
    int goal_index_{0};
    bool mission_complete_{false};
};

namespace inmission
{
struct Underway : boost::statechart::state<Underway, InMission, underway::Movement>,
                  AppMethodsAccess<Underway>
{
    using StateBase = boost::statechart::state<Underway, InMission, underway::Movement>;

    Underway(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "Underway" << std::endl;
    }
    ~Underway() { goby::glog.is_debug1() && goby::glog << "~Underway" << std::endl; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvReturnToHome, underway::Recovery>,
        boost::statechart::transition<EvAbort, underway::Abort>,
        boost::statechart::transition<EvStop, underway::recovery::Stopped>,
        boost::statechart::transition<EvRCSetpoint, underway::movement::remotecontrol::Setpoint>>;
};

namespace underway
{
struct Replan : boost::statechart::state<Replan, Underway>,
                Notify<Replan, protobuf::IN_MISSION__UNDERWAY__REPLAN,
                       protobuf::SETPOINT_IVP_HELM // stationkeep
                       >
{
    using StateBase = boost::statechart::state<Replan, Underway>;
    Replan(typename StateBase::my_context c) : StateBase(c) {}
    ~Replan() {}

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvMissionInfeasible, Replan>, // maybe in_state_reaction
        boost::statechart::transition<EvMissionFeasible, Movement>>;
};

struct Movement : boost::statechart::state<Movement, Underway, movement::MovementSelection,
                                           boost::statechart::has_deep_history>,
                  AppMethodsAccess<Movement>
{
    using StateBase = boost::statechart::state<Movement, Underway, movement::MovementSelection,
                                               boost::statechart::has_deep_history>;

    Movement(typename StateBase::my_context c) : StateBase(c)
    {
        // replan case - update mission from event
        auto mission_feasible_event = dynamic_cast<const EvMissionFeasible*>(triggering_event());
        if (mission_feasible_event)
        {
            this->machine().set_mission_plan(
                mission_feasible_event->plan,
                false); // do not reset the datum on Replanned missions to avoid a race condition with IvP
        }
    }
    ~Movement() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvPerformTask, Task>>;
};

namespace movement
{
// dummy state that should immediately transit to the correct Movement child state based on the current mission movement value
struct MovementSelection : boost::statechart::state<MovementSelection, Movement>,
                           AppMethodsAccess<MovementSelection>
{
    struct EvMovementSelect : boost::statechart::event<EvMovementSelect>
    {
    };

    using StateBase = boost::statechart::state<MovementSelection, Movement>;
    MovementSelection(typename StateBase::my_context c) : StateBase(c)
    {
        post_event(EvMovementSelect());
    }
    ~MovementSelection() {}

    boost::statechart::result react(const EvMovementSelect&)
    {
        switch (this->machine().mission_plan().movement())
        {
            case protobuf::MissionPlan::TRANSIT: return transit<Transit>();
            case protobuf::MissionPlan::REMOTE_CONTROL: return transit<RemoteControl>();
        }

        // should never reach here but if does, abort the mission
        return transit<underway::Abort>();
    }

    using reactions = boost::statechart::custom_reaction<EvMovementSelect>;
};

struct Transit : boost::statechart::state<Transit, Movement>,
                 Notify<Transit, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT,
                        protobuf::SETPOINT_IVP_HELM // waypoint
                        >
{
    using StateBase = boost::statechart::state<Transit, Movement>;
    Transit(typename StateBase::my_context c);
    ~Transit();

    void waypoint_reached(const EvWaypointReached&)
    {
        goby::glog.is_debug1() && goby::glog << "Waypoint reached" << std::endl;
        post_event(EvPerformTask());
    }

    using reactions = boost::statechart::in_state_reaction<EvWaypointReached, Transit,
                                                           &Transit::waypoint_reached>;
};

struct RemoteControl
    : boost::statechart::state<RemoteControl, Movement, remotecontrol::RemoteControlEndSelection>
{
    using StateBase =
        boost::statechart::state<RemoteControl, Movement, remotecontrol::RemoteControlEndSelection>;
    RemoteControl(typename StateBase::my_context c) : StateBase(c) {}
    ~RemoteControl() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvResumeMovement, Movement>>;
};

namespace remotecontrol
{
// dummy state that should immediately transit to the correct RemoteControl child state based on the configured rc_setpoint_end value
struct RemoteControlEndSelection
    : boost::statechart::state<RemoteControlEndSelection, RemoteControl>,
      AppMethodsAccess<RemoteControlEndSelection>
{
    struct EvRCEndSelect : boost::statechart::event<EvRCEndSelect>
    {
    };

    using StateBase = boost::statechart::state<RemoteControlEndSelection, RemoteControl>;
    RemoteControlEndSelection(typename StateBase::my_context c) : StateBase(c)
    {
        post_event(EvRCEndSelect());
    }
    ~RemoteControlEndSelection() {}

    boost::statechart::result react(const EvRCEndSelect&);

    using reactions = boost::statechart::custom_reaction<EvRCEndSelect>;
};

struct StationKeep
    : boost::statechart::state<StationKeep, RemoteControl>,
      Notify<StationKeep, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP,
             protobuf::SETPOINT_IVP_HELM // stationkeep
             >
{
    using StateBase = boost::statechart::state<StationKeep, RemoteControl>;
    StationKeep(typename StateBase::my_context c);
    ~StationKeep();
};

struct SurfaceDrift
    : boost::statechart::state<SurfaceDrift, RemoteControl>,
      Notify<SurfaceDrift, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<SurfaceDrift, RemoteControl>;
    SurfaceDrift(typename StateBase::my_context c) : StateBase(c) {}
    ~SurfaceDrift() {}

    void loop(const EvLoop&);

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, SurfaceDrift, &SurfaceDrift::loop>>;
};

struct Setpoint
    : boost::statechart::state<Setpoint, RemoteControl>,
      Notify<Setpoint, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SETPOINT,
             protobuf::SETPOINT_REMOTE_CONTROL>
{
    using StateBase = boost::statechart::state<Setpoint, RemoteControl>;
    Setpoint(typename StateBase::my_context c);
    ~Setpoint() {}

    void loop(const EvLoop&);

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvRCSetpointComplete, RemoteControlEndSelection>,
        boost::statechart::in_state_reaction<EvLoop, Setpoint, &Setpoint::loop>>;

  private:
    goby::time::SteadyClock::time_point setpoint_stop_;
    protobuf::RemoteControl rc_setpoint_;
};
} // namespace remotecontrol

} // namespace movement

struct Task : boost::statechart::state<Task, Underway, task::TaskSelection>
{
    using StateBase = boost::statechart::state<Task, Underway, task::TaskSelection>;

    Task(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug2() && goby::glog << "Entering Task" << std::endl;
        auto perform_task_event = dynamic_cast<const EvPerformTask*>(triggering_event());
        if (perform_task_event && perform_task_event->has_task)
        {
            manual_task_ = perform_task_event->task;
            has_manual_task_ = true;
        }
    }
    ~Task()
    {
        if (!has_manual_task_)
            // each time we complete a autonomous task - we should increment the goal index
            context<InMission>().increment_goal_index();
    }

    // see if we have a manual task or a planned task available and return it
    boost::optional<protobuf::MissionTask> current_task()
    {
        if (has_manual_task_)
            return boost::optional<protobuf::MissionTask>(manual_task_);
        else
            return context<InMission>().current_planned_task();
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvTaskComplete,
                                      boost::statechart::deep_history<movement::Transit // default
                                                                      >>>;

  private:
    protobuf::MissionTask manual_task_;
    bool has_manual_task_{false};
};

namespace task
{
// similar to MovementSelection but for Tasks
struct TaskSelection : boost::statechart::state<TaskSelection, Task>,
                       AppMethodsAccess<TaskSelection>
{
    struct EvTaskSelect : boost::statechart::event<EvTaskSelect>
    {
    };

    using StateBase = boost::statechart::state<TaskSelection, Task>;
    TaskSelection(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug2() && goby::glog << "Entering TaskSelect" << std::endl;
        post_event(EvTaskSelect());
    }
    ~TaskSelection() {}

    boost::statechart::result react(const EvTaskSelect&)
    {
        boost::optional<protobuf::MissionTask> current_task = context<Task>().current_task();

        if (current_task)
        {
            goby::glog.is_verbose() && goby::glog << group("task") << "Starting task: "
                                                  << current_task.get().ShortDebugString()
                                                  << std::endl;

            switch (current_task->type())
            {
                case protobuf::MissionTask::DIVE: return transit<Dive>();
                case protobuf::MissionTask::STATION_KEEP: return transit<StationKeep>();
                case protobuf::MissionTask::SURFACE_DRIFT: return transit<SurfaceDrift>();
            }
        }

        // no task or invalid task, so consider it complete
        goby::glog.is_verbose() && goby::glog << group("task")
                                              << "No task for this goal. Proceeding to next goal"
                                              << std::endl;
        post_event(EvTaskComplete());
        return discard_event();
    }

    using reactions = boost::statechart::custom_reaction<EvTaskSelect>;
};

struct StationKeep : boost::statechart::state<StationKeep, Task>,
                     Notify<StationKeep, protobuf::IN_MISSION__UNDERWAY__TASK__STATION_KEEP,
                            protobuf::SETPOINT_IVP_HELM // stationkeep
                            >
{
    using StateBase = boost::statechart::state<StationKeep, Task>;
    StationKeep(typename StateBase::my_context c);
    ~StationKeep();
};

struct SurfaceDrift : boost::statechart::state<SurfaceDrift, Task>,
                      Notify<SurfaceDrift, protobuf::IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT,
                             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<SurfaceDrift, Task>;
    SurfaceDrift(typename StateBase::my_context c);
    ~SurfaceDrift() {}

    void loop(const EvLoop&);

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, SurfaceDrift, &SurfaceDrift::loop>>;

  private:
    goby::time::SteadyClock::time_point drift_time_stop_;
};

struct Dive : boost::statechart::state<Dive, Task, dive::PoweredDescent>, AppMethodsAccess<Dive>
{
    using StateBase = boost::statechart::state<Dive, Task, dive::PoweredDescent>;

    Dive(typename StateBase::my_context c);
    ~Dive();

    const protobuf::MissionTask::DiveParameters& current_dive()
    {
        return context<Task>().current_task()->dive();
    }

    bool dive_complete() { return dive_depths_.empty(); }
    boost::units::quantity<boost::units::si::length> goal_depth() { return dive_depths_.front(); }
    void pop_goal_depth() { dive_depths_.pop_front(); }
    jaiabot::protobuf::DivePacket& dive_packet() { return dive_packet_; }

    void add_to_dive_duration(goby::time::MicroTime time) { dive_duration_ += time; }

    void set_seafloor_reached(boost::units::quantity<boost::units::si::length> seafloor_depth)
    {
        // remove any more depth goals, and set the current goal to the measured depth
        dive_depths_.clear();
        dive_depths_.push_back(seafloor_depth);
    }

  private:
    std::deque<boost::units::quantity<boost::units::si::length>> dive_depths_;

    jaiabot::protobuf::DivePacket dive_packet_;

    goby::time::MicroTime dive_duration_{0 * boost::units::si::seconds};
};
namespace dive
{
struct PoweredDescent
    : boost::statechart::state<PoweredDescent, Dive>,
      Notify<PoweredDescent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_DESCENT,
             protobuf::SETPOINT_DIVE>
{
    using StateBase = boost::statechart::state<PoweredDescent, Dive>;
    PoweredDescent(typename StateBase::my_context c);
    ~PoweredDescent();

    void loop(const EvLoop&);
    void depth(const EvVehicleDepth& ev);

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvDepthTargetReached, Hold>,
        boost::statechart::in_state_reaction<EvLoop, PoweredDescent, &PoweredDescent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, PoweredDescent,
                                             &PoweredDescent::depth>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime duration_correction_{0 * boost::units::si::seconds};

    // keep track of the depth changes so we can detect if we've hit the seafloor
    boost::units::quantity<boost::units::si::length> last_depth_;
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
};

struct Hold
    : boost::statechart::state<Hold, Dive>,
      Notify<Hold, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__HOLD, protobuf::SETPOINT_DIVE>
{
    using StateBase = boost::statechart::state<Hold, Dive>;
    Hold(typename StateBase::my_context c);
    ~Hold();

    void loop(const EvLoop&);
    void measurement(const EvMeasurement& ev);
    void depth(const EvVehicleDepth& ev);

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvHoldComplete, PoweredDescent>,
        boost::statechart::in_state_reaction<EvLoop, Hold, &Hold::loop>,
        boost::statechart::in_state_reaction<EvMeasurement, Hold, &Hold::measurement>,
        boost::statechart::in_state_reaction<EvVehicleDepth, Hold, &Hold::depth>,
        boost::statechart::transition<EvDiveComplete, UnpoweredAscent>>;

  private:
    goby::time::SteadyClock::time_point hold_stop_;
    jaiabot::protobuf::DivePacket::Measurements& measurement_;

    std::vector<boost::units::quantity<boost::units::si::length>> depths_;
    std::vector<boost::units::quantity<boost::units::absolute<boost::units::celsius::temperature>>>
        temperatures_;
    std::vector<double> salinities_;
};

struct UnpoweredAscent
    : boost::statechart::state<UnpoweredAscent, Dive>,
      Notify<UnpoweredAscent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__UNPOWERED_ASCENT,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<UnpoweredAscent, Dive>;
    UnpoweredAscent(typename StateBase::my_context c);
    ~UnpoweredAscent();

    void loop(const EvLoop&);
    void depth(const EvVehicleDepth& ev);

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvSurfacingTimeout, PoweredAscent>,
        boost::statechart::in_state_reaction<EvLoop, UnpoweredAscent, &UnpoweredAscent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, UnpoweredAscent,
                                             &UnpoweredAscent::depth>>;

  private:
    goby::time::SteadyClock::time_point timeout_stop_;

    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
};

struct PoweredAscent
    : boost::statechart::state<PoweredAscent, Dive>,
      Notify<PoweredAscent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_ASCENT,
             protobuf::SETPOINT_POWERED_ASCENT>
{
    using StateBase = boost::statechart::state<PoweredAscent, Dive>;
    PoweredAscent(typename StateBase::my_context c) : StateBase(c) {}
    ~PoweredAscent();

    void loop(const EvLoop&);
    void depth(const EvVehicleDepth& ev);

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, PoweredAscent, &PoweredAscent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, PoweredAscent, &PoweredAscent::depth>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
};

} // namespace dive
} // namespace task

struct Recovery : boost::statechart::state<Recovery, Underway, recovery::Transit>
{
    using StateBase = boost::statechart::state<Recovery, Underway, recovery::Transit>;

    Recovery(typename StateBase::my_context c) : StateBase(c)
    {
        // once we go into recovery (for any reason), the mission is considered complete
        context<InMission>().set_mission_complete();
    }
    ~Recovery() {}
};

namespace recovery
{
struct Transit : boost::statechart::state<Transit, Recovery>,
                 Notify<Transit, protobuf::IN_MISSION__UNDERWAY__RECOVERY__TRANSIT,
                        protobuf::SETPOINT_IVP_HELM // waypoint
                        >
{
    using StateBase = boost::statechart::state<Transit, Recovery>;
    Transit(typename StateBase::my_context c);
    ~Transit();

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvWaypointReached, StationKeep>>;
};

struct StationKeep : boost::statechart::state<StationKeep, Recovery>,
                     Notify<StationKeep, protobuf::IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP,
                            protobuf::SETPOINT_IVP_HELM // stationkeep
                            >
{
    using StateBase = boost::statechart::state<StationKeep, Recovery>;
    StationKeep(typename StateBase::my_context c);
    ~StationKeep();

    using reactions = boost::mpl::list<boost::statechart::transition<EvStop, Stopped>>;
};

struct Stopped : boost::statechart::state<Stopped, Recovery>,
                 Notify<Stopped, protobuf::IN_MISSION__UNDERWAY__RECOVERY__STOPPED>
{
    using StateBase = boost::statechart::state<Stopped, Recovery>;
    Stopped(typename StateBase::my_context c);
    ~Stopped() {}
};
} // namespace recovery

struct Abort : boost::statechart::state<Abort, Underway>,
               Notify<Abort, protobuf::IN_MISSION__UNDERWAY__ABORT>
{
    using StateBase = boost::statechart::state<Abort, Underway>;
    Abort(typename StateBase::my_context c) : StateBase(c)
    {
        // once we go into abort, the mission is considered complete
        context<InMission>().set_mission_complete();
    }
    ~Abort() {}
};

} // namespace underway
} // namespace inmission

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

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvBeginDataProcessing, DataProcessing>>;
};

struct DataProcessing : boost::statechart::state<DataProcessing, PostDeployment>,
                        Notify<DataProcessing, protobuf::POST_DEPLOYMENT__DATA_PROCESSING>
{
    using StateBase = boost::statechart::state<DataProcessing, PostDeployment>;
    DataProcessing(typename StateBase::my_context c) : StateBase(c) {}
    ~DataProcessing() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvDataProcessingComplete, DataOffload>>;
};

struct DataOffload : boost::statechart::state<DataOffload, PostDeployment>,
                     Notify<DataOffload, protobuf::POST_DEPLOYMENT__DATA_OFFLOAD>
{
    using StateBase = boost::statechart::state<DataOffload, PostDeployment>;
    DataOffload(typename StateBase::my_context c) : StateBase(c) {}
    ~DataOffload() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvDataOffloadComplete, Idle>>;
};

struct Idle : boost::statechart::state<Idle, PostDeployment>,
              Notify<Idle, protobuf::POST_DEPLOYMENT__IDLE>
{
    using StateBase = boost::statechart::state<Idle, PostDeployment>;
    Idle(typename StateBase::my_context c) : StateBase(c) {}
    ~Idle() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvShutdown, ShuttingDown>>;
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

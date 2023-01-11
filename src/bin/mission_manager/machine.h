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
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/util/constants.h>
#include <goby/util/debug_logger.h>
#include <goby/util/linebasedcomms/nmea_sentence.h>

#include "config.pb.h"
#include "jaiabot/groups.h"
#include "jaiabot/messages/dive_debug.pb.h"
#include "jaiabot/messages/high_control.pb.h"
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/mission.pb.h"
#include "machine_common.h"

#include <algorithm>
#include <iostream>
#include <numeric>
#include <queue>
#include <vector>

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
STATECHART_EVENT(EvStarted)
STATECHART_EVENT(EvStartupTimeout)
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
STATECHART_EVENT(EvRetryDataOffload)
STATECHART_EVENT(EvShutdown)
STATECHART_EVENT(EvActivate)
STATECHART_EVENT(EvDepthTargetReached)
STATECHART_EVENT(EvDiveComplete)
STATECHART_EVENT(EvHoldComplete)
STATECHART_EVENT(EvSurfacingTimeout)
STATECHART_EVENT(EvSurfaced)
STATECHART_EVENT(EvGPSFix)
STATECHART_EVENT(EvGPSNoFix)

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

struct EvVehicleGPS : boost::statechart::event<EvVehicleGPS>
{
    double hdop;
    double pdop;
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
struct StartingUp;
struct Idle;
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
struct ReacquireGPS;
struct RemoteControl;
namespace remotecontrol
{
struct RemoteControlEndSelection;
struct ReacquireGPS;
struct StationKeep;
struct SurfaceDrift;
struct Setpoint;
} // namespace remotecontrol

} // namespace movement

struct Task;
namespace task
{
struct TaskSelection;
struct ReacquireGPS;
struct StationKeep;
struct SurfaceDrift;
struct ConstantHeading;
struct Dive;
namespace dive
{
struct PoweredDescent;
struct Hold;
struct UnpoweredAscent;
struct PoweredAscent;
struct ReacquireGPS;
struct SurfaceDrift;
} // namespace dive
} // namespace task

struct Recovery;
namespace recovery
{
struct Transit;
struct ReacquireGPS;
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

    void insert_warning(jaiabot::protobuf::Warning warning) { warnings_.insert(warning); }
    void erase_warning(jaiabot::protobuf::Warning warning) { warnings_.erase(warning); }
    void erase_infeasible_mission_warnings()
    {
        for (auto it = warnings_.begin(); it != warnings_.end();)
        {
            if (jaiabot::protobuf::Warning_Name(*it).find("INFEASIBLE_MISSION") !=
                std::string::npos)
                it = warnings_.erase(it);
            else
                ++it;
        }
    }
    void health(goby::middleware::protobuf::ThreadHealth& health)
    {
        for (auto warning : warnings_)
            health.MutableExtension(jaiabot::protobuf::jaiabot_thread)->add_warning(warning);
        if (!warnings_.empty() && health.state() == goby::middleware::protobuf::HEALTH__OK)
            health.set_state(goby::middleware::protobuf::HEALTH__DEGRADED);
    }

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

    void set_gps_tpv(const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv,
                     const goby::middleware::protobuf::gpsd::SkyView& sky)
    {
        if ((sky.hdop() <= transit_hdop_req_) && (sky.pdop() <= transit_pdop_req_))
        {
            tpv_ = tpv;
        }
    }
    const goby::middleware::protobuf::gpsd::TimePositionVelocity& gps_tpv() const { return tpv_; }

    void set_transit_hdop_req(const double& transit_hdop) { transit_hdop_req_ = transit_hdop; }
    const double& transit_hdop_req() { return transit_hdop_req_; }

    void set_transit_pdop_req(const double& transit_pdop) { transit_pdop_req_ = transit_pdop; }
    const double& transit_pdop_req() { return transit_pdop_req_; }

    void set_after_dive_hdop_req(const double& after_dive_hdop)
    {
        after_dive_hdop_req_ = after_dive_hdop;
    }
    const double& after_dive_hdop_req() { return after_dive_hdop_req_; }

    void set_after_dive_pdop_req(const double& after_dive_pdop)
    {
        after_dive_pdop_req_ = after_dive_pdop;
    }
    const double& after_dive_pdop_req() { return after_dive_pdop_req_; }

    void set_transit_gps_fix_checks(const uint32_t& transit_gps_fix_checks)
    {
        transit_gps_fix_checks_ = transit_gps_fix_checks;
    }
    const uint32_t& transit_gps_fix_checks() { return transit_gps_fix_checks_; }

    void set_transit_gps_degraded_fix_checks(const uint32_t& transit_gps_degraded_fix_checks)
    {
        transit_gps_degraded_fix_checks_ = transit_gps_degraded_fix_checks;
    }
    const uint32_t& transit_gps_degraded_fix_checks() { return transit_gps_degraded_fix_checks_; }

    void set_after_dive_gps_fix_checks(const uint32_t& after_dive_gps_fix_checks)
    {
        after_dive_gps_fix_checks_ = after_dive_gps_fix_checks;
    }
    const uint32_t& after_dive_gps_fix_checks() { return after_dive_gps_fix_checks_; }

  private:
    apps::MissionManager& app_;
    jaiabot::protobuf::MissionState state_{jaiabot::protobuf::PRE_DEPLOYMENT__IDLE};
    jaiabot::protobuf::MissionPlan plan_;
    jaiabot::protobuf::SetpointType setpoint_type_{jaiabot::protobuf::SETPOINT_STOP};
    std::unique_ptr<goby::util::UTMGeodesy> geodesy_;
    std::set<jaiabot::protobuf::Warning> warnings_;
    goby::middleware::protobuf::gpsd::TimePositionVelocity tpv_;
    double transit_hdop_req_{cfg().gps_hdop_fix()};
    double transit_pdop_req_{cfg().gps_pdop_fix()};
    double after_dive_hdop_req_{cfg().gps_after_dive_hdop_fix()};
    double after_dive_pdop_req_{cfg().gps_after_dive_pdop_fix()};
    uint32_t transit_gps_fix_checks_{cfg().total_gps_fix_checks()};
    uint32_t transit_gps_degraded_fix_checks_{cfg().total_gps_degraded_fix_checks()};
    uint32_t after_dive_gps_fix_checks_{cfg().total_after_dive_gps_fix_checks()};
};

struct PreDeployment
    : boost::statechart::state<PreDeployment,              // (CRTP)
                               MissionManagerStateMachine, // Parent state (or machine)
                               predeployment::StartingUp   // Initial child substate
                               >
{
    using StateBase = boost::statechart::state<PreDeployment, MissionManagerStateMachine,
                                               predeployment::StartingUp>;

    // entry action
    PreDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PreDeployment() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, postdeployment::ShuttingDown>>;
};

namespace predeployment
{
struct StartingUp : boost::statechart::state<StartingUp, PreDeployment>,
                    Notify<StartingUp, protobuf::PRE_DEPLOYMENT__STARTING_UP>
{
    using StateBase = boost::statechart::state<StartingUp, PreDeployment>;
    StartingUp(typename StateBase::my_context c);
    ~StartingUp();

    void loop(const EvLoop&);

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvStarted, Idle>,
        boost::statechart::transition<EvStartupTimeout, Failed>,
        boost::statechart::in_state_reaction<EvLoop, StartingUp, &StartingUp::loop>>;

  private:
    goby::time::SteadyClock::time_point timeout_stop_;
};

struct Idle : boost::statechart::state<Idle, PreDeployment>,
              Notify<Idle, protobuf::PRE_DEPLOYMENT__IDLE>
{
    using StateBase = boost::statechart::state<Idle, PreDeployment>;
    Idle(typename StateBase::my_context c);
    ~Idle();

    using reactions = boost::mpl::list<boost::statechart::transition<EvActivate, SelfTest>>;
};

struct SelfTest : boost::statechart::state<SelfTest, PreDeployment>,
                  Notify<SelfTest, protobuf::PRE_DEPLOYMENT__SELF_TEST>
{
    using StateBase = boost::statechart::state<SelfTest, PreDeployment>;
    SelfTest(typename StateBase::my_context c) : StateBase(c)
    {
        // TODO add timeout on SelfTest and then post Fails if timeout passes
    }
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

    // allow Activate from Failed in case an error resolves itself
    // while the vehicle is powered on (e.g. GPS fix after several minutes).
    // If Activate is sent and the vehicle still has an error,
    // SelfTest will simply fail again and we'll end up back here in Failed (as desired)
    using reactions = boost::mpl::list<boost::statechart::transition<EvActivate, SelfTest>>;
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
            this->machine().set_mission_plan(plan,
                                             true); // reset the datum on the initial mission
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

    boost::optional<jaiabot::protobuf::GeographicCoordinate> current_goal_location() const
    {
        const auto& mission_plan = this->machine().mission_plan();
        if (goal_index() >= this->machine().mission_plan().goal_size() ||
            goal_index() == RECOVERY_GOAL_INDEX)
        {
            if (mission_plan.recovery().has_recover_at_final_goal())
            {
                if (mission_plan.recovery().recover_at_final_goal())
                {
                    return jaiabot::protobuf::GeographicCoordinate(
                        this->machine()
                            .mission_plan()
                            .goal(mission_plan.goal_size() - 1)
                            .location());
                }
                else
                {
                    return boost::none;
                }
            }
            else if (mission_plan.recovery().has_location())
            {
                return jaiabot::protobuf::GeographicCoordinate(mission_plan.recovery().location());
            }
            else
            {
                return boost::none;
            }
        }
        else
        {
            return jaiabot::protobuf::GeographicCoordinate(
                this->machine().mission_plan().goal(goal_index()).location());
        }
    }

    boost::optional<jaiabot::protobuf::GeographicCoordinate> recovery_goal_location() const
    {
        const auto& mission_plan = this->machine().mission_plan();
        if (mission_plan.recovery().has_recover_at_final_goal())
        {
            if (mission_plan.recovery().recover_at_final_goal())
            {
                return jaiabot::protobuf::GeographicCoordinate(
                    this->machine().mission_plan().goal(mission_plan.goal_size() - 1).location());
            }
        }
        else if (mission_plan.recovery().has_location())
        {
            return jaiabot::protobuf::GeographicCoordinate(mission_plan.recovery().location());
        }
        else
        {
            return boost::none;
        }
    }

    boost::optional<double> current_speed() const
    {
        const auto& mission_plan = this->machine().mission_plan();
        if (goal_index() >= this->machine().mission_plan().goal_size() ||
            goal_index() == RECOVERY_GOAL_INDEX)
        {
            return boost::optional<double>(mission_plan.speeds().stationkeep_outer());
        }
        else
        {
            return boost::optional<double>(mission_plan.speeds().transit());
        }
    }

    boost::optional<double> current_distance_to_goal() const
    {
        auto current_location = this->machine().gps_tpv().location();
        auto current_goal = current_goal_location().value();

        if (current_location.has_lat() && current_location.has_lon() &&
            current_goal_location().has_value())
        {
            double distance = distanceToGoal(current_goal.lat(), current_goal.lon(),
                                             current_location.lat(), current_location.lon());

            // Set distance in meters
            distance = distance * (1000);

            return boost::optional<double>(distance);
        }
        else
        {
            return boost::none;
        }
    }

    void add_to_goal_distance_history()
    {
        auto current_time = goby::time::SteadyClock::now();

        if (current_distance_to_goal().has_value())
        {
            // Check the queue size to ensure it is less than max
            if (current_goal_dist_history_.size() >= cfg().tpv_history_max())
            {
                linear_regression_slope_ = linear_regression_slope(current_goal_dist_history_);
                current_goal_dist_history_.pop();
            }
            current_goal_dist_history_.push({current_time, current_distance_to_goal().value()});
        }
    }
    const bool making_forward_progress_to_goal() const
    {
        if (linear_regression_slope_ < 0)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    boost::optional<int> total_goal_timeout() const
    {
        return boost::optional<int>(total_goal_timeout_);
    }

    int current_goal_timeout() const
    {
        auto current_time = goby::time::SteadyClock::now();
        // Confirm goal_timeout_ is initialized
        if (total_goal_timeout().has_value())
        {
            auto current_goal_timeout = std::chrono::duration_cast<std::chrono::seconds>(
                (last_goal_timeout_time_ + std::chrono::seconds(total_goal_timeout_)) -
                current_time);

            goby::glog.is_debug2() &&
                goby::glog << "Goal time out: " << current_goal_timeout.count() << std::endl;

            return current_goal_timeout.count();
        }
        else
        {
            return 0;
        }
    }

    bool skip_goal_task() const { return skip_goal_task_; }

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

    void calculate_goal_dist()
    {
        auto current_time = goby::time::SteadyClock::now();

        if (current_distance_to_goal().has_value() && current_speed().has_value())
        {
            total_goal_timeout_ = (current_distance_to_goal().value() / current_speed().value()) *
                                      cfg().goal_timeout_buffer_factor() +
                                  (this->machine().transit_gps_fix_checks() *
                                   cfg().goal_timeout_reacquire_gps_attempts());
        }

        // Clear current_goal_dist_history_ to start new with update goal
        std::queue<std::pair<goby::time::SteadyClock::time_point, double>> empty;
        std::swap(current_goal_dist_history_, empty);

        last_goal_timeout_time_ = current_time;
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

    void set_goal_index_to_final_goal()
    {
        // Sets goal index to be the final goal index
        goal_index_ = (this->machine().mission_plan().goal_size() - 1);
    }

    void set_mission_complete() { mission_complete_ = true; }

    // This function converts decimal degrees to radians
    double deg2rad(const double& deg) const { return (deg * M_PI / 180); }

    /**
     * Returns the distance between two points on the Earth.
     * Direct translation from http://en.wikipedia.org/wiki/Haversine_formula
     * @param lat1d Latitude of the first point in degrees
     * @param lon1d Longitude of the first point in degrees
     * @param lat2d Latitude of the second point in degrees
     * @param lon2d Longitude of the second point in degrees
     * @return The distance between the two points in kilometers
     */
    double distanceToGoal(const double& lat1d, const double& lon1d, const double& lat2d,
                          const double& lon2d) const
    {
        double lat1r, lon1r, lat2r, lon2r, u, v;
        lat1r = deg2rad(lat1d);
        lon1r = deg2rad(lon1d);
        lat2r = deg2rad(lat2d);
        lon2r = deg2rad(lon2d);
        u = sin((lat2r - lat1r) / 2);
        v = sin((lon2r - lon1r) / 2);
        return 2.0 * earthRadiusKm_ * asin(sqrt(u * u + cos(lat1r) * cos(lat2r) * v * v));
    }

    /**
 * @brief Used to calculate slope from bots goal dist history.
 * If the vehicle is making progress towards goal than the slope should
 * be negative.
 *
 * @param goal_dist_history
 * @return double (slope)
 */
    double linear_regression_slope(
        const std::queue<std::pair<goby::time::SteadyClock::time_point, double>>& goal_dist_history)
    {
        std::queue<std::pair<goby::time::SteadyClock::time_point, double>> copy_goal_dist_history;
        std::vector<double> x;
        std::vector<double> y;

        // Copy queue values into separate vectors
        while (!copy_goal_dist_history.empty())
        {
            x.push_back(copy_goal_dist_history.front().first.time_since_epoch().count());
            y.push_back(copy_goal_dist_history.front().second);
            copy_goal_dist_history.pop();
        }

        const auto n = x.size();
        const auto s_x = std::accumulate(x.begin(), x.end(), 0.0);
        const auto s_y = std::accumulate(y.begin(), y.end(), 0.0);
        const auto s_xx = std::inner_product(x.begin(), x.end(), x.begin(), 0.0);
        const auto s_xy = std::inner_product(x.begin(), x.end(), y.begin(), 0.0);
        const auto a = (n * s_xy - s_x * s_y) / (n * s_xx - s_x * s_x);
        return a;
    }
    using reactions =
        boost::mpl::list<boost::statechart::transition<EvNewMission, inmission::underway::Replan>,
                         boost::statechart::transition<EvRecovered, PostDeployment>>;

  private:
    int goal_index_{0};
    bool mission_complete_{false};
    double earthRadiusKm_{6371.0};
    int total_goal_timeout_{0};
    goby::time::SteadyClock::time_point last_goal_timeout_time_{std::chrono::seconds(0)};
    bool skip_goal_task_{cfg().skip_goal_task()};
    std::queue<std::pair<goby::time::SteadyClock::time_point, double>> current_goal_dist_history_;
    double linear_regression_slope_{-1};
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
// Base class for all AcquiredGPS as these do nearly the same thing.
// "Derived" MUST be a child state of Task
template <typename Derived, typename Parent, jaiabot::protobuf::MissionState state>
struct AcquiredGPSCommon : boost::statechart::state<Derived, Parent>,
                           Notify<Derived, state, protobuf::SETPOINT_IVP_HELM>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    AcquiredGPSCommon(typename StateBase::my_context c) : StateBase(c){};

    ~AcquiredGPSCommon(){};

    void gps(const EvVehicleGPS& ev)
    {
        if ((ev.hdop <= this->machine().transit_hdop_req()) &&
            (ev.pdop <= this->machine().transit_pdop_req()))
        {
            // Reset Counter For Degraded Checks
            gps_degraded_fix_check_incr_ = 0;

            // Add to current dist to goal in history queue.
            // This is used to determine if we are making
            // progress to next goal
            //context<InMission>().add_to_goal_distance_history();
            this->template context<InMission>().add_to_goal_distance_history();
        }
        else
        {
            // Increment degraded checks until we are > the threshold for confirming degraded gps
            if (gps_degraded_fix_check_incr_ <
                (this->machine().transit_gps_degraded_fix_checks() - 1))
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a degraded fix, but has not "
                                  "reached threshold for total checks: "
                                  " "
                               << gps_degraded_fix_check_incr_ << " < "
                               << (this->machine().transit_gps_degraded_fix_checks() - 1)
                               << std::endl;

                // Increment until we reach total gps degraded fix checks
                gps_degraded_fix_check_incr_++;
            }
            else
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a degraded fix, Post EvGPSNoFix, hdop is " << ev.hdop
                               << " > " << this->machine().transit_hdop_req() << ", pdop is "
                               << ev.pdop << " > " << this->machine().transit_pdop_req()
                               << " Reset incr for gps fix" << std::endl;

                // Post Event for no gps fix
                this->post_event(statechart::EvGPSNoFix());
            }
        }
    }

    using reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvVehicleGPS, AcquiredGPSCommon,
                                                              &AcquiredGPSCommon::gps>>;

  private:
    int gps_degraded_fix_check_incr_{0};
};

// Base class for all Task ReacquireGPS as these do nearly the same thing.
// "Derived" MUST be a child state of Task
template <typename Derived, typename Parent, jaiabot::protobuf::MissionState state>
struct ReacquireGPSCommon : boost::statechart::state<Derived, Parent>,
                            Notify<Derived, state, protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    ReacquireGPSCommon(typename StateBase::my_context c) : StateBase(c)
    {
        if (this->app().is_test_mode(config::MissionManager::ENGINEERING_TEST__INDOOR_MODE__NO_GPS))
        {
            // in indoor mode, simply post that we've received a fix
            // (even though we haven't as there's no GPS)
            this->post_event(statechart::EvGPSFix());
        }
    };

    ~ReacquireGPSCommon(){};

    void gps(const EvVehicleGPS& ev)
    {
        if ((ev.hdop <= this->machine().transit_hdop_req()) &&
            (ev.pdop <= this->machine().transit_pdop_req()))
        {
            // Increment gps fix checks until we are > the threshold for confirming gps fix
            if (gps_fix_check_incr_ < (this->machine().transit_gps_fix_checks() - 1))
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a good fix, but has not "
                                  "reached threshold for total checks"
                                  " "
                               << gps_fix_check_incr_ << " < "
                               << (this->machine().transit_gps_fix_checks() - 1) << std::endl;
                // Increment until we reach total gps fix checks
                gps_fix_check_incr_++;
            }
            else
            {
                goby::glog.is_debug2() &&
                    goby::glog << "GPS has a good fix, Post EvGPSFix, hdop is " << ev.hdop
                               << " <= " << this->machine().transit_hdop_req() << ", pdop is "
                               << ev.pdop << " <= " << this->machine().transit_pdop_req()
                               << " Reset incr for gps degraded fix" << std::endl;

                // Post Event for gps fix
                this->post_event(statechart::EvGPSFix());
            }
        }
        else
        {
            // Reset gps fix incrementor
            gps_fix_check_incr_ = 0;
        }
    }

    using reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPSCommon,
                                                              &ReacquireGPSCommon::gps>>;

  private:
    int gps_fix_check_incr_{0};
};

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

struct Transit
    : AcquiredGPSCommon<Transit, Movement, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT>
{
    Transit(typename StateBase::my_context c);
    ~Transit();

    void waypoint_reached(const EvWaypointReached&)
    {
        goby::glog.is_debug1() && goby::glog << "Waypoint reached" << std::endl;
        post_event(EvPerformTask());
    }

    using reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvWaypointReached, Transit,
                                                              &Transit::waypoint_reached>,
                         boost::statechart::transition<EvGPSNoFix, ReacquireGPS>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, AcquiredGPSCommon,
                                                              &AcquiredGPSCommon::gps>>;
};

struct ReacquireGPS : ReacquireGPSCommon<ReacquireGPS, Movement,
                                         protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REACQUIRE_GPS>
{
    ReacquireGPS(typename StateBase::my_context c)
        : ReacquireGPSCommon<ReacquireGPS, Movement,
                             protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REACQUIRE_GPS>(c)
    {
    }
    ~ReacquireGPS(){};

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvGPSFix, Transit>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPSCommon,
                                                              &ReacquireGPSCommon::gps>>;
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

struct ReacquireGPS
    : ReacquireGPSCommon<ReacquireGPS, RemoteControl,
                         protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__REACQUIRE_GPS>
{
    ReacquireGPS(typename StateBase::my_context c)
        : ReacquireGPSCommon<
              ReacquireGPS, RemoteControl,
              protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__REACQUIRE_GPS>(c)
    {
    }
    ~ReacquireGPS(){};

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvGPSFix, StationKeep>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPSCommon,
                                                              &ReacquireGPSCommon::gps>>;
};

struct StationKeep
    : AcquiredGPSCommon<StationKeep, RemoteControl,
                        protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP>
{
    using StateBase = boost::statechart::state<StationKeep, RemoteControl>;
    StationKeep(typename StateBase::my_context c);
    ~StationKeep();

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvGPSNoFix, ReacquireGPS>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, AcquiredGPSCommon,
                                                              &AcquiredGPSCommon::gps>>;
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

struct Task : boost::statechart::state<Task, Underway, task::TaskSelection>, AppMethodsAccess<Task>

{
    using StateBase = boost::statechart::state<Task, Underway, task::TaskSelection>;

    Task(typename StateBase::my_context c);
    ~Task();

    // see if we have a manual task or a planned task available and return it
    boost::optional<protobuf::MissionTask> current_task()
    {
        if (has_manual_task_)
            return boost::optional<protobuf::MissionTask>(manual_task_);
        else
            return context<InMission>().current_planned_task();
    }

    jaiabot::protobuf::TaskPacket& task_packet() { return task_packet_; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvTaskComplete,
                                      boost::statechart::deep_history<movement::Transit // default
                                                                      >>>;

  private:
    protobuf::MissionTask manual_task_;
    bool has_manual_task_{false};
    jaiabot::protobuf::TaskPacket task_packet_;
};

namespace task
{
// Base class for all Task SurfaceDrifts as these do nearly the same thing.
// "Derived" MUST be a child state of Task
template <typename Derived, typename Parent, jaiabot::protobuf::MissionState state>
struct SurfaceDriftTaskCommon : boost::statechart::state<Derived, Parent>,
                                Notify<Derived, state, protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    SurfaceDriftTaskCommon(typename StateBase::my_context c) : StateBase(c)
    {
        goby::time::SteadyClock::time_point drift_time_start = goby::time::SteadyClock::now();

        auto drift_time = this->template context<Task>()
                              .current_task()
                              ->surface_drift()
                              .template drift_time_with_units<goby::time::SITime>();

        drift_packet().set_drift_duration_with_units(drift_time);

        int drift_time_seconds = drift_time.value();
        goby::time::SteadyClock::duration drift_time_duration =
            std::chrono::seconds(drift_time_seconds);
        drift_time_stop_ = drift_time_start + drift_time_duration;

        if (this->machine().gps_tpv().has_location())
        {
            const auto& pos = this->machine().gps_tpv().location();
            auto& start = *drift_packet().mutable_start_location();
            start.set_lat_with_units(pos.lat_with_units());
            start.set_lon_with_units(pos.lon_with_units());
        }
    }

    ~SurfaceDriftTaskCommon()
    {
        if (this->machine().gps_tpv().has_location())
        {
            const auto& pos = this->machine().gps_tpv().location();
            auto& end = *drift_packet().mutable_end_location();
            end.set_lat_with_units(pos.lat_with_units());
            end.set_lon_with_units(pos.lon_with_units());
        }

        // compute estimated drift if possible
        if (drift_packet().has_start_location() && drift_packet().has_end_location() &&
            drift_packet().has_drift_duration() && drift_packet().drift_duration() > 0)
        {
            auto start = drift_packet().start_location(), end = drift_packet().end_location();
            auto start_xy = this->machine().geodesy().convert(
                     {start.lat_with_units(), start.lon_with_units()}),
                 end_xy = this->machine().geodesy().convert(
                     {end.lat_with_units(), end.lon_with_units()});

            auto sx = start_xy.x, sy = start_xy.y, ex = end_xy.x, ey = end_xy.y;
            auto dx = ex - sx, dy = ey - sy;
            auto dt = drift_packet().drift_duration_with_units();

            auto& drift = *drift_packet().mutable_estimated_drift();
            drift.set_speed_with_units(boost::units::sqrt(dx * dx + dy * dy) / dt);

            auto heading = goby::util::pi<double> / 2 * boost::units::si::radians -
                                         boost::units::atan2(dy, dx);
            if (heading < 0 * boost::units::si::radians) heading = heading + (goby::util::pi<double> * 2 * boost::units::si::radians);
            drift.set_heading_with_units(heading);
        }
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= drift_time_stop_)
        {
            this->post_event(EvTaskComplete());

            if (this->template context<Task>().task_packet().dive().reached_min_depth())
            {
                this->template context<InMission>().set_goal_index_to_final_goal();
                this->post_event(statechart::EvReturnToHome());
            }
        }

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        this->interprocess().template publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }

    jaiabot::protobuf::DriftPacket& drift_packet()
    {
        return *(this->template context<Task>().task_packet().mutable_drift());
    }

    using reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvLoop, SurfaceDriftTaskCommon,
                                                              &SurfaceDriftTaskCommon::loop>>;

  private:
    goby::time::SteadyClock::time_point drift_time_stop_;
};

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

        if (current_task && current_task->type() != protobuf::MissionTask::NONE)
        {
            goby::glog.is_verbose() && goby::glog << group("task") << "Starting task: "
                                                  << current_task.get().ShortDebugString()
                                                  << std::endl;

            switch (current_task->type())
            {
                case protobuf::MissionTask::DIVE: return transit<Dive>();
                case protobuf::MissionTask::STATION_KEEP: return transit<StationKeep>();
                case protobuf::MissionTask::SURFACE_DRIFT: return transit<SurfaceDrift>();
                case protobuf::MissionTask::CONSTANT_HEADING: return transit<ConstantHeading>();
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

struct ReacquireGPS
    : ReacquireGPSCommon<ReacquireGPS, Task, protobuf::IN_MISSION__UNDERWAY__TASK__REACQUIRE_GPS>
{
    ReacquireGPS(typename StateBase::my_context c)
        : ReacquireGPSCommon<ReacquireGPS, Task,
                             protobuf::IN_MISSION__UNDERWAY__TASK__REACQUIRE_GPS>(c)
    {
    }
    ~ReacquireGPS(){};

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvGPSFix, StationKeep>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPSCommon,
                                                              &ReacquireGPSCommon::gps>>;
};

struct StationKeep
    : AcquiredGPSCommon<StationKeep, Task, protobuf::IN_MISSION__UNDERWAY__TASK__STATION_KEEP>
{
    using StateBase = boost::statechart::state<StationKeep, Task>;
    StationKeep(typename StateBase::my_context c);
    ~StationKeep();

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvGPSNoFix, ReacquireGPS>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, AcquiredGPSCommon,
                                                              &AcquiredGPSCommon::gps>>;
};

struct SurfaceDrift : SurfaceDriftTaskCommon<SurfaceDrift, Task,
                                             protobuf::IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT>
{
    SurfaceDrift(typename StateBase::my_context c)
        : SurfaceDriftTaskCommon<SurfaceDrift, Task,
                                 protobuf::IN_MISSION__UNDERWAY__TASK__SURFACE_DRIFT>(c)
    {
    }
};

struct ConstantHeading
    : boost::statechart::state<ConstantHeading, Task>, 
      Notify<ConstantHeading, protobuf::IN_MISSION__UNDERWAY__TASK__CONSTANT_HEADING,
             protobuf::SETPOINT_IVP_HELM>
{
    using StateBase = boost::statechart::state<ConstantHeading, Task>;
    ConstantHeading(typename StateBase::my_context c);
    ~ConstantHeading();

    void loop(const EvLoop&);

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, ConstantHeading, &ConstantHeading::loop>>;

  private:
    goby::time::SteadyClock::time_point setpoint_stop_;
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
    jaiabot::protobuf::DivePacket& dive_packet()
    {
        return *context<Task>().task_packet().mutable_dive();
    }

    void add_to_dive_duration(goby::time::MicroTime time) { dive_duration_ += time; }

    void set_seafloor_reached(boost::units::quantity<boost::units::si::length> seafloor_depth)
    {
        // remove any more depth goals, and set the current goal to the measured depth
        dive_depths_.clear();
        dive_depths_.push_back(seafloor_depth);
        dive_packet().set_bottom_dive(true);

        goby::glog.is_debug2() && goby::glog << "Seafloor Depth: " << seafloor_depth.value()
                                             << " , Safety Depth: " << cfg().min_depth_safety()
                                             << std::endl;

        if (seafloor_depth.value() <= (cfg().min_depth_safety() + cfg().dive_depth_eps()))
        {
            dive_packet().set_reached_min_depth(true);
        }
    }

  private:
    std::deque<boost::units::quantity<boost::units::si::length>> dive_depths_;
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
    //Keep track of dive information
    jaiabot::protobuf::DivePowerDescentDebug dive_pdescent_debug_;
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
    //Keep track of dive information
    jaiabot::protobuf::DiveHoldDebug dive_hold_debug_;
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
        boost::statechart::transition<EvSurfaced, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvLoop, UnpoweredAscent, &UnpoweredAscent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, UnpoweredAscent,
                                             &UnpoweredAscent::depth>>;

  private:
    goby::time::SteadyClock::time_point timeout_stop_;

    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    //Keep track of dive information
    jaiabot::protobuf::DiveUnpoweredAscentDebug dive_uascent_debug_;
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
        boost::statechart::transition<EvSurfaced, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvLoop, PoweredAscent, &PoweredAscent::loop>,
        boost::statechart::in_state_reaction<EvVehicleDepth, PoweredAscent, &PoweredAscent::depth>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    //Keep track of dive information
    jaiabot::protobuf::DivePoweredAscentDebug dive_pascent_debug_;
};

struct ReacquireGPS
    : boost::statechart::state<ReacquireGPS, Dive>,
      Notify<PoweredAscent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<ReacquireGPS, Dive>;
    ReacquireGPS(typename StateBase::my_context c);
    ~ReacquireGPS();

    void gps(const EvVehicleGPS& ev)
    {
        if ((ev.hdop <= this->machine().after_dive_hdop_req()) &&
            (ev.pdop <= this->machine().after_dive_pdop_req()))
        {
            // Increment gps fix checks until we are > the threshold for confirming gps fix
            if (gps_fix_check_incr_ < (this->machine().after_dive_gps_fix_checks() - 1))
            {
                goby::glog.is_debug1() &&
                    goby::glog << "GPS has a good fix, but has not "
                                  "reached threshold for total checks"
                                  " "
                               << gps_fix_check_incr_ << " < "
                               << (this->machine().after_dive_gps_fix_checks() - 1) << std::endl;
                // Increment until we reach total gps fix checks
                gps_fix_check_incr_++;
            }
            else
            {
                goby::glog.is_debug1() &&
                    goby::glog << "GPS has a good fix, Post EvGPSFix, hdop is " << ev.hdop
                               << " <= " << this->machine().after_dive_hdop_req() << ", pdop is "
                               << ev.pdop << " <= " << this->machine().after_dive_pdop_req()
                               << " Reset incr for gps degraded fix" << std::endl;

                goby::glog.is_debug2() &&
                    goby::glog << "Reached Min depth: "
                               << context<Task>().task_packet().dive().reached_min_depth()
                               << " , Skip drift: " << this->cfg().min_depth_safety_skip_drift()
                               << std::endl;

                if (context<Task>().task_packet().dive().reached_min_depth() &&
                    this->cfg().min_depth_safety_skip_drift())
                {
                    context<InMission>().set_goal_index_to_final_goal();
                    this->post_event(statechart::EvReturnToHome());
                }
                else
                {
                    // Post Event for gps fix
                    this->post_event(statechart::EvGPSFix());
                }
            }
        }
        else
        {
            // Reset gps fix incrementor
            gps_fix_check_incr_ = 0;
        }
    }

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPS, &ReacquireGPS::gps>,
        boost::statechart::transition<EvGPSFix, SurfaceDrift>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()},
        end_time_;
    int gps_fix_check_incr_{0};
};

struct SurfaceDrift
    : SurfaceDriftTaskCommon<SurfaceDrift, Dive,
                             protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT>
{
    SurfaceDrift(typename StateBase::my_context c)
        : SurfaceDriftTaskCommon<SurfaceDrift, Dive,
                                 protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__SURFACE_DRIFT>(c)
    {
    }
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
struct Transit
    : AcquiredGPSCommon<Transit, Recovery, protobuf::IN_MISSION__UNDERWAY__RECOVERY__TRANSIT>
{
    Transit(typename StateBase::my_context c);
    ~Transit();

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvWaypointReached, StationKeep>,
                         boost::statechart::transition<EvGPSNoFix, ReacquireGPS>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, AcquiredGPSCommon,
                                                              &AcquiredGPSCommon::gps>>;
};

struct ReacquireGPS : ReacquireGPSCommon<ReacquireGPS, Recovery,
                                         protobuf::IN_MISSION__UNDERWAY__RECOVERY__REACQUIRE_GPS>
{
    ReacquireGPS(typename StateBase::my_context c)
        : ReacquireGPSCommon<ReacquireGPS, Recovery,
                             protobuf::IN_MISSION__UNDERWAY__RECOVERY__REACQUIRE_GPS>(c)
    {
    }
    ~ReacquireGPS(){};

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvGPSFix, Transit>,
                         boost::statechart::transition<EvGPSFix, StationKeep>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, ReacquireGPSCommon,
                                                              &ReacquireGPSCommon::gps>>;
};

struct StationKeep : AcquiredGPSCommon<StationKeep, Recovery,
                                       protobuf::IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP>
{
    using StateBase = boost::statechart::state<StationKeep, Recovery>;
    StationKeep(typename StateBase::my_context c);
    ~StationKeep();

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvStop, Stopped>,
                         boost::statechart::transition<EvGPSNoFix, ReacquireGPS>,
                         boost::statechart::in_state_reaction<EvVehicleGPS, AcquiredGPSCommon,
                                                              &AcquiredGPSCommon::gps>>;
};

struct Stopped : boost::statechart::state<Stopped, Recovery>,
                 Notify<Stopped, protobuf::IN_MISSION__UNDERWAY__RECOVERY__STOPPED>
{
    using StateBase = boost::statechart::state<Stopped, Recovery>;
    Stopped(typename StateBase::my_context c);
    ~Stopped() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, postdeployment::ShuttingDown>>;
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
    Recovered(typename StateBase::my_context c) : StateBase(c)
    {
        // automatically go into data procesing
        post_event(EvBeginDataProcessing());
    }
    ~Recovered() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvBeginDataProcessing, DataProcessing>>;
};

struct DataProcessing : boost::statechart::state<DataProcessing, PostDeployment>,
                        Notify<DataProcessing, protobuf::POST_DEPLOYMENT__DATA_PROCESSING>
{
    using StateBase = boost::statechart::state<DataProcessing, PostDeployment>;
    DataProcessing(typename StateBase::my_context c);
    ~DataProcessing() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvDataProcessingComplete, DataOffload>>;
};

struct DataOffload : boost::statechart::state<DataOffload, PostDeployment>,
                     Notify<DataOffload, protobuf::POST_DEPLOYMENT__DATA_OFFLOAD>
{
    using StateBase = boost::statechart::state<DataOffload, PostDeployment>;
    DataOffload(typename StateBase::my_context c);
    ~DataOffload() {}

    void loop(const EvLoop&);

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvDataOffloadComplete, Idle>,
        boost::statechart::in_state_reaction<EvLoop, DataOffload, &DataOffload::loop>>;

  private:
    std::unique_ptr<std::thread> offload_thread_;
    // used by offload_thread_
    std::atomic<bool> offload_success_{false};
    std::atomic<bool> offload_complete_{false};
    const std::string offload_command_;
};

struct Idle : boost::statechart::state<Idle, PostDeployment>,
              Notify<Idle, protobuf::POST_DEPLOYMENT__IDLE>
{
    using StateBase = boost::statechart::state<Idle, PostDeployment>;
    Idle(typename StateBase::my_context c);
    ~Idle();

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, ShuttingDown>,
                         boost::statechart::transition<EvRetryDataOffload, DataOffload>,
                         boost::statechart::transition<EvActivate, predeployment::SelfTest>>;
};

struct ShuttingDown : boost::statechart::state<ShuttingDown, PostDeployment>,
                      Notify<ShuttingDown, protobuf::POST_DEPLOYMENT__SHUTTING_DOWN>
{
    using StateBase = boost::statechart::state<ShuttingDown, PostDeployment>;
    ShuttingDown(typename StateBase::my_context c);
    ~ShuttingDown() {}
};

} // namespace postdeployment

} // namespace statechart
} // namespace jaiabot
#endif

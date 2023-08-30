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
#include "jaiabot/messages/pressure_temperature.pb.h"
#include "machine_common.h"
#include <fstream>
#include <goby/util/seawater.h>
#include <google/protobuf/util/json_util.h>

#include "jaiabot/messages/imu.pb.h"
using jaiabot::protobuf::IMUCommand;

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
struct EvRCOverrideFailed : boost::statechart::event<EvRCOverrideFailed>
{
    EvRCOverrideFailed(const jaiabot::protobuf::MissionPlan& p) : plan(p) {}
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
STATECHART_EVENT(EvDivePrepComplete)
STATECHART_EVENT(EvDepthTargetReached)
STATECHART_EVENT(EvDiveComplete)
STATECHART_EVENT(EvPowerDescentSafety)
STATECHART_EVENT(EvHoldComplete)
STATECHART_EVENT(EvDiveRising)
STATECHART_EVENT(EvBotNotVertical)
STATECHART_EVENT(EvSurfacingTimeout)
STATECHART_EVENT(EvSurfaced)
STATECHART_EVENT(EvGPSFix)
STATECHART_EVENT(EvGPSNoFix)
STATECHART_EVENT(EvIMURestart)
STATECHART_EVENT(EvIMURestartCompleted)
STATECHART_EVENT(EvBottomDepthAbort)

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

struct EvVehiclePitch : boost::statechart::event<EvVehiclePitch>
{
    boost::units::quantity<boost::units::degree::plane_angle> pitch;
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
struct IMURestart;
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
struct IMURestart;
struct StationKeep;
struct SurfaceDrift;
struct ConstantHeading;
struct Dive;
namespace dive
{
struct DivePrep;
struct PoweredDescent;
struct Hold;
struct UnpoweredAscent;
struct PoweredAscent;
struct ReacquireGPS;
struct SurfaceDrift;
struct ConstantHeading;
} // namespace dive
} // namespace task

struct Recovery;
namespace recovery
{
struct Transit;
struct ReacquireGPS;
struct IMURestart;
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

    void set_gps_tpv(const goby::middleware::protobuf::gpsd::TimePositionVelocity& tpv)
    {
        tpv_ = tpv;
    }
    const goby::middleware::protobuf::gpsd::TimePositionVelocity& gps_tpv() { return tpv_; }

    void calculate_pressure_adjusted(
        const jaiabot::protobuf::PressureTemperatureData& pressure_temperature)
    {
        jaiabot::protobuf::PressureAdjustedData pa;

        set_current_pressure(pressure_temperature.pressure_raw());

        pa.set_pressure_raw(pressure_temperature.pressure_raw());
        pa.set_pressure_raw_before_dive(start_of_dive_pressure());

        auto pressure_adjusted = pa.pressure_raw() - pa.pressure_raw_before_dive();

        goby::glog.is_debug2() &&
            goby::glog << "Pressure RAW: " << pa.pressure_raw()
                       << ", Pressure RAW Start of Dive: " << pa.pressure_raw_before_dive()
                       << ", Adjusted: " << pressure_adjusted << std::endl;

        pa.set_pressure_adjusted(pressure_adjusted);

        // Calculate Depth From Pressure Adjusted
        auto depth = goby::util::seawater::depth(pa.pressure_adjusted_with_units(), latest_lat());
        post_event(statechart::EvVehicleDepth(depth));

        pa.set_calculated_depth_with_units(depth);

        interprocess().publish<jaiabot::groups::pressure_adjusted>(pa);
    }

    void set_start_of_dive_pressure(double start_of_dive_pressure)
    {
        start_of_dive_pressure_ = start_of_dive_pressure;
    }
    const double& start_of_dive_pressure() { return start_of_dive_pressure_; }

    void set_current_pressure(double current_pressure) { current_pressure_ = current_pressure; }
    const double& current_pressure() { return current_pressure_; }

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

    void
    set_bottom_depth_safety_constant_heading(const double& bottom_depth_safety_constant_heading)
    {
        bottom_depth_safety_constant_heading_ = bottom_depth_safety_constant_heading;
    }
    const double& bottom_depth_safety_constant_heading()
    {
        return bottom_depth_safety_constant_heading_;
    }

    void set_bottom_depth_safety_constant_heading_speed(
        const double& bottom_depth_safety_constant_heading_speed)
    {
        bottom_depth_safety_constant_heading_speed_ = bottom_depth_safety_constant_heading_speed;
    }
    const double& bottom_depth_safety_constant_heading_speed()
    {
        return bottom_depth_safety_constant_heading_speed_;
    }

    void set_bottom_depth_safety_constant_heading_time(
        const double& bottom_depth_safety_constant_heading_time)
    {
        bottom_depth_safety_constant_heading_time_ = bottom_depth_safety_constant_heading_time;
    }
    const double& bottom_depth_safety_constant_heading_time()
    {
        return bottom_depth_safety_constant_heading_time_;
    }

    void set_bottom_safety_depth(const double& bottom_safety_depth)
    {
        bottom_safety_depth_ = bottom_safety_depth;
    }
    const double& bottom_safety_depth() { return bottom_safety_depth_; }

    void set_latest_lat(const boost::units::quantity<boost::units::degree::plane_angle>& latest_lat)
    {
        latest_lat_ = latest_lat;
    }
    const boost::units::quantity<boost::units::degree::plane_angle>& latest_lat()
    {
        return latest_lat_;
    }

    void set_latest_max_acceleration(
        const boost::units::quantity<boost::units::si::acceleration>& latest_max_acceleration)
    {
        latest_max_acceleration_ = latest_max_acceleration;
    }
    const boost::units::quantity<boost::units::si::acceleration>& latest_max_acceleration()
    {
        return latest_max_acceleration_;
    }

    void set_latest_significant_wave_height(const double& latest_significant_wave_height)
    {
        latest_significant_wave_height_ = latest_significant_wave_height;
    }
    const double& latest_significant_wave_height() { return latest_significant_wave_height_; }

    void set_create_task_packet_file(const bool& create_task_packet_file)
    {
        create_task_packet_file_ = create_task_packet_file;
    }
    const bool& create_task_packet_file() { return create_task_packet_file_; }

    void set_task_packet_file_name(const std::string& task_packet_file_name)
    {
        task_packet_file_name_ = task_packet_file_name;
    }
    const std::string& task_packet_file_name() { return task_packet_file_name_; }

    const std::string& create_file_date_time()
    {
        auto now = std::chrono::system_clock::now();
        std::time_t currentTime = std::chrono::system_clock::to_time_t(now);

        std::tm* localTime = std::localtime(&currentTime);

        std::ostringstream oss;
        oss << (localTime->tm_year + 1900) << std::setw(2) << std::setfill('0')
            << (localTime->tm_mon + 1) << std::setw(2) << std::setfill('0') << localTime->tm_mday
            << "T" << std::setw(2) << std::setfill('0') << localTime->tm_hour << std::setw(2)
            << std::setfill('0') << localTime->tm_min << std::setw(2) << std::setfill('0')
            << localTime->tm_sec;

        data_time_string_ = oss.str();

        return data_time_string_;
    }

    void set_rf_disable(const bool& rf_disable) { rf_disable_ = rf_disable; }
    const bool& rf_disable() { return rf_disable_; }

    void set_hub_id(const int32_t& hub_id) { hub_id_ = hub_id; }
    const int32_t& hub_id() { return hub_id_; }

    void set_data_offload_exclude(const std::string& data_offload_exclude)
    {
        data_offload_exclude_ = data_offload_exclude;
    }
    const std::string& data_offload_exclude() { return data_offload_exclude_; }

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
    double start_of_dive_pressure_{0};
    double current_pressure_{0};
    // if we don't get latitude information, we'll compute depth based on mid-latitude
    // (45 degrees), which will introduce up to 0.27% error at 500 meters depth
    // at the equator or the poles
    boost::units::quantity<boost::units::degree::plane_angle> latest_lat_{
        45 * boost::units::degree::degrees};
    bool rf_disable_{false};
    // IMUData.max_acceleration, to characterize the bottom type
    boost::units::quantity<boost::units::si::acceleration> latest_max_acceleration_{
        0 * boost::units::si::meter_per_second_squared};
    double latest_significant_wave_height_{0};
    double bottom_depth_safety_constant_heading_{0};
    double bottom_depth_safety_constant_heading_speed_{0};
    double bottom_depth_safety_constant_heading_time_{0};
    double bottom_safety_depth_{cfg().min_depth_safety()};
    // Task Packet
    bool create_task_packet_file_{true};
    std::string task_packet_file_name_{""};
    std::string data_time_string_{""};
    int32_t hub_id_{0};
    std::string data_offload_exclude_{""};
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
        boost::mpl::list<boost::statechart::transition<EvShutdown, postdeployment::ShuttingDown>,
                         boost::statechart::transition<EvRecovered, postdeployment::Recovered>>;
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
    Failed(typename StateBase::my_context c);
    ~Failed();
    void loop(const EvLoop&);

    void isFeasibleMissionRC(const EvMissionFeasible& ev)
    {
        if (ev.plan.movement() == protobuf::MissionPlan_MovementType_REMOTE_CONTROL)
        {
            goby::glog.is_debug1() && goby::glog << "Mission Plan is rc, override failed state."
                                                 << std::endl;

            post_event(EvRCOverrideFailed(ev.plan));
        }
    }

    // allow Activate from Failed in case an error resolves itself
    // while the vehicle is powered on (e.g. GPS fix after several minutes).
    // If Activate is sent and the vehicle still has an error,
    // SelfTest will simply fail again and we'll end up back here in Failed (as desired)
    // Check the mission to see if is a rc mission. If it is then we should override.
    using reactions =
        boost::mpl::list<boost::statechart::transition<EvActivate, SelfTest>,
                         boost::statechart::transition<EvRCOverrideFailed, Ready>,
                         boost::statechart::in_state_reaction<EvLoop, Failed, &Failed::loop>,
                         boost::statechart::in_state_reaction<EvMissionFeasible, Failed,
                                                              &Failed::isFeasibleMissionRC>>;

  private:
    // determines when to stop logging
    goby::time::SteadyClock::time_point failed_startup_log_timeout_;
};

struct WaitForMissionPlan
    : boost::statechart::state<WaitForMissionPlan, PreDeployment>,
      Notify<WaitForMissionPlan, protobuf::PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN>
{
    using StateBase = boost::statechart::state<WaitForMissionPlan, PreDeployment>;
    WaitForMissionPlan(typename StateBase::my_context c) : StateBase(c) {}
    ~WaitForMissionPlan() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvMissionFeasible, Ready>,
                         // maybe change to in_state_reaction?
                         boost::statechart::transition<EvMissionInfeasible, WaitForMissionPlan>>;
};

struct Ready : boost::statechart::state<Ready, PreDeployment>,
               Notify<Ready, protobuf::PRE_DEPLOYMENT__READY>
{
    using StateBase = boost::statechart::state<Ready, PreDeployment>;
    Ready(typename StateBase::my_context c) : StateBase(c)
    {
        auto mission_feasible_event = dynamic_cast<const EvMissionFeasible*>(triggering_event());
        auto mission_feasible_override_event =
            dynamic_cast<const EvRCOverrideFailed*>(triggering_event());

        if (mission_feasible_event)
        {
            goby::glog.is_debug1() && goby::glog << "Ready: mission_feasible_event." << std::endl;
            const auto plan = mission_feasible_event->plan;
            // reset the datum on the initial mission
            this->machine().set_mission_plan(plan, true);
            if (plan.start() == protobuf::MissionPlan::START_IMMEDIATELY)
                post_event(EvDeployed());
        }
        else if (mission_feasible_override_event)
        {
            goby::glog.is_debug1() && goby::glog << "Ready: mission_feasible_override_event."
                                                 << std::endl;

            const auto plan = mission_feasible_override_event->plan;
            // reset the datum on the initial mission
            this->machine().set_mission_plan(plan, true);
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
    constexpr static int SURF_EGRESS_GOAL_INDEX{-2};

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
        const auto& repeats = this->machine().mission_plan().repeats();
        const auto& goal_size = this->machine().mission_plan().goal_size();

        ++goal_index_;

        // all goals completed
        if (goal_index_ >= goal_size)
        {
            ++repeat_index_;

            goby::glog.is_verbose() && goby::glog << group("movement") << "Repeat " << repeat_index_
                                                  << "/" << repeats << ": all goals complete"
                                                  << std::endl;

            // all repeats completed
            if (repeat_index_ >= repeats)
            {
                goby::glog.is_verbose() &&
                    goby::glog << group("movement") << "All repeats complete, mission is complete."
                               << std::endl;
                set_mission_complete();
                goal_index_ = RECOVERY_GOAL_INDEX;
            }
            else
            {
                // Do next repeat, starting with first goal
                goal_index_ = 0;
            }
        }
    }

    void set_goal_index_to_final_goal()
    {
        // Sets goal index to be the final goal index
        goal_index_ = (this->machine().mission_plan().goal_size() - 1);
    }

    void set_mission_complete() { mission_complete_ = true; }

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvNewMission, inmission::underway::Replan>,
                         boost::statechart::transition<EvRecovered, PostDeployment>>;

  private:
    int goal_index_{0};
    int repeat_index_{0};
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
// Base class for all AcquiredGPS as these do nearly the same thing.
// "Derived" MUST be a child state of Task
template <typename Derived, typename Parent, jaiabot::protobuf::MissionState state>
struct AcquiredGPSCommon : boost::statechart::state<Derived, Parent>,
                           Notify<Derived, state, protobuf::SETPOINT_IVP_HELM>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    AcquiredGPSCommon(typename StateBase::my_context c) : StateBase(c)
    {
        this->machine().erase_warning(jaiabot::protobuf::WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
    }

    ~AcquiredGPSCommon(){};

    void gps(const EvVehicleGPS& ev)
    {
        if ((ev.hdop <= this->machine().transit_hdop_req()) &&
            (ev.pdop <= this->machine().transit_pdop_req()))
        {
            // Reset Counter For Degraded Checks
            gps_degraded_fix_check_incr_ = 0;
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
        else
        {
            this->machine().insert_warning(
                jaiabot::protobuf::WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
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

// Base class for all Task IMURestart as these do nearly the same thing.
// "Derived" MUST be a child state of Task
template <typename Derived, typename Parent, jaiabot::protobuf::MissionState state>
struct IMURestartCommon : boost::statechart::state<Derived, Parent>,
                          Notify<Derived, state, protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<Derived, Parent>;
    IMURestartCommon(typename StateBase::my_context c) : StateBase(c)
    {
        goby::time::SteadyClock::time_point imu_restart_start = goby::time::SteadyClock::now();

        // Read in configurable time to stay in IMU Restart State
        int imu_restart_seconds = this->cfg().imu_restart_seconds();
        goby::time::SteadyClock::duration imu_restart_duration =
            std::chrono::seconds(imu_restart_seconds);
        imu_restart_time_stop_ = imu_restart_start + imu_restart_duration;
    };

    ~IMURestartCommon(){};

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= imu_restart_time_stop_)
        {
            this->post_event(EvIMURestartCompleted());
        }
    }

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, IMURestartCommon, &IMURestartCommon::loop>>;

  private:
    goby::time::SteadyClock::time_point imu_restart_time_stop_;
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
                                                              &AcquiredGPSCommon::gps>,
                         boost::statechart::transition<EvIMURestart, IMURestart>>;
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

struct IMURestart
    : IMURestartCommon<IMURestart, Movement, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__IMU_RESTART>
{
    IMURestart(typename StateBase::my_context c)
        : IMURestartCommon<IMURestart, Movement,
                           protobuf::IN_MISSION__UNDERWAY__MOVEMENT__IMU_RESTART>(c)
    {
    }
    ~IMURestart(){};

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvIMURestartCompleted, Transit>,
        boost::statechart::in_state_reaction<EvLoop, IMURestartCommon, &IMURestartCommon::loop>>;
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
    SurfaceDrift(typename StateBase::my_context c) : StateBase(c)
    {
        // Stop the craft
        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }
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

        goby::glog.is_debug1() &&
            goby::glog << group("task") << "SurfaceDriftTaskCommon Starting Wave Height Sampling"
                       << std::endl;

        // Start wave height sampling
        auto imu_command = IMUCommand();
        imu_command.set_type(IMUCommand::START_WAVE_HEIGHT_SAMPLING);
        this->interprocess().template publish<jaiabot::groups::imu>(imu_command);
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

            // Set the wave height and period
            drift_packet().set_significant_wave_height(
                this->machine().latest_significant_wave_height());

            goby::glog.is_debug1() &&
                goby::glog << group("task")
                           << "~SurfaceDriftTaskCommon Stopping Wave Height Sampling" << std::endl;

            // Stop wave height sampling
            auto imu_command = IMUCommand();
            imu_command.set_type(IMUCommand::STOP_WAVE_HEIGHT_SAMPLING);
            this->interprocess().template publish<jaiabot::groups::imu>(imu_command);
        }
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

        if (now >= drift_time_stop_)
        {
            this->post_event(EvTaskComplete());
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
        goby::glog.is_debug2() && goby::glog << group("task") << "Entering TaskSelect" << std::endl;
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

struct IMURestart
    : IMURestartCommon<IMURestart, Task, protobuf::IN_MISSION__UNDERWAY__TASK__IMU_RESTART>
{
    IMURestart(typename StateBase::my_context c)
        : IMURestartCommon<IMURestart, Task, protobuf::IN_MISSION__UNDERWAY__TASK__IMU_RESTART>(c)
    {
    }
    ~IMURestart(){};

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvIMURestartCompleted, StationKeep>,
        boost::statechart::in_state_reaction<EvLoop, IMURestartCommon, &IMURestartCommon::loop>>;
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
                                                              &AcquiredGPSCommon::gps>,
                         boost::statechart::transition<EvIMURestart, IMURestart>>;
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

struct Dive : boost::statechart::state<Dive, Task, dive::DivePrep>, AppMethodsAccess<Dive>
{
    using StateBase = boost::statechart::state<Dive, Task, dive::DivePrep>;

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

        goby::glog.is_debug2() &&
            goby::glog << "Seafloor Depth: " << seafloor_depth.value()
                       << " , Safety Depth: " << this->machine().bottom_safety_depth() << std::endl;

        if (seafloor_depth.value() <=
            (this->machine().bottom_safety_depth() + cfg().dive_depth_eps()))
        {
            dive_packet().set_reached_min_depth(true);
            this->machine().insert_warning(
                jaiabot::protobuf::
                    WARNING__MISSION__INFEASIBLE_MISSION__MINIMUM_BOTTOM_DEPTH_REACHED);
        }
    }

    void set_current_depth(const boost::units::quantity<boost::units::si::length>& current_depth)
    {
        current_depth_ = current_depth;
    }

    const boost::units::quantity<boost::units::si::length> current_depth()
    {
        return current_depth_;
    }

  private:
    std::deque<boost::units::quantity<boost::units::si::length>> dive_depths_;
    goby::time::MicroTime dive_duration_{0 * boost::units::si::seconds};
    boost::units::quantity<boost::units::si::length> current_depth_{0};
};
namespace dive
{
struct DivePrep : boost::statechart::state<DivePrep, Dive>,
                  Notify<DivePrep, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__DIVE_PREP,
                         protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<DivePrep, Dive>;
    DivePrep(typename StateBase::my_context c);
    ~DivePrep();

    void loop(const EvLoop&);
    void pitch(const EvVehiclePitch& ev);

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, DivePrep, &DivePrep::loop>,
        boost::statechart::transition<EvDivePrepComplete, PoweredDescent>,
        boost::statechart::in_state_reaction<EvVehiclePitch, DivePrep, &DivePrep::pitch>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime duration_{0 * boost::units::si::seconds};
    // determines when to transition into powered descent
    goby::time::SteadyClock::time_point dive_prep_timeout_;
    // keep check of current bot angle for pitch
    int pitch_angle_check_incr_{0};
    goby::time::MicroTime last_pitch_dive_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
};

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
                                             &PoweredDescent::depth>,
        boost::statechart::transition<EvPowerDescentSafety, UnpoweredAscent>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime duration_correction_{0 * boost::units::si::seconds};

    // keep track of the depth changes so we can detect if we've hit the seafloor
    boost::units::quantity<boost::units::si::length> last_depth_{0};
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
    // keep track of dive information
    jaiabot::protobuf::DivePowerDescentDebug dive_pdescent_debug_;
    // determines when to start using powered descent logic
    goby::time::SteadyClock::time_point detect_bottom_logic_init_timeout_;
    // determines when to safely timout of powered descent and transition into unpowered ascent
    goby::time::SteadyClock::time_point powered_descent_timeout_;
    bool bot_is_diving_{false};
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
    goby::time::MicroTime detect_depth_changes_init_timeout_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};

    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    //Keep track of dive information
    jaiabot::protobuf::DiveUnpoweredAscentDebug dive_uascent_debug_;
    // keep track of the depth changes so we can detect if we are stuck
    boost::units::quantity<boost::units::si::length> last_depth_{context<Dive>().current_depth()};
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
};

struct PoweredAscent
    : boost::statechart::state<PoweredAscent, Dive>,
      Notify<PoweredAscent, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__POWERED_ASCENT,
             protobuf::SETPOINT_POWERED_ASCENT>
{
    using StateBase = boost::statechart::state<PoweredAscent, Dive>;
    PoweredAscent(typename StateBase::my_context c);
    ~PoweredAscent();

    void loop(const EvLoop&);
    void depth(const EvVehicleDepth& ev);
    void pitch(const EvVehiclePitch& ev);

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvSurfaced, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvLoop, PoweredAscent, &PoweredAscent::loop>,
        boost::statechart::transition<EvDiveRising, UnpoweredAscent>,
        boost::statechart::transition<EvBotNotVertical, ReacquireGPS>,
        boost::statechart::in_state_reaction<EvVehicleDepth, PoweredAscent, &PoweredAscent::depth>,
        boost::statechart::in_state_reaction<EvVehiclePitch, PoweredAscent, &PoweredAscent::pitch>>;

  private:
    goby::time::MicroTime start_time_{goby::time::SystemClock::now<goby::time::MicroTime>()};
    // keep track of dive information
    jaiabot::protobuf::DivePoweredAscentDebug dive_pascent_debug_;
    // determines when to turn on motor during powered ascent
    goby::time::SteadyClock::time_point powered_ascent_motor_on_timeout_;
    // determines when to turn off motor during powered ascent
    goby::time::SteadyClock::time_point powered_ascent_motor_off_timeout_;
    // determines duration to have the motor on
    goby::time::SteadyClock::duration powered_ascent_motor_on_duration_ =
        std::chrono::seconds(cfg().powered_ascent_motor_on_timeout());
    // determines duration to have the motor off
    goby::time::SteadyClock::duration powered_ascent_motor_off_duration_ =
        std::chrono::seconds(cfg().powered_ascent_motor_off_timeout());
    // determines wehn we are still in motor off mode
    bool in_motor_off_mode_{false};
    // keep track of the depth changes so we can detect if we are stuck
    boost::units::quantity<boost::units::si::length> last_depth_{context<Dive>().current_depth()};
    goby::time::MicroTime last_depth_change_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
    double powered_ascent_throttle_{cfg().powered_ascent_throttle()};
    // keep check of current bot angle for pitch
    int pitch_angle_check_incr_{0};
    goby::time::MicroTime last_pitch_dive_time_{
        goby::time::SystemClock::now<goby::time::MicroTime>()};
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
                               << std::endl;

                if (context<Task>().task_packet().dive().reached_min_depth())
                {
                    context<InMission>().set_goal_index_to_final_goal();
                    this->post_event(EvBottomDepthAbort());
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
        boost::statechart::transition<EvBottomDepthAbort, ConstantHeading>,
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

struct ConstantHeading
    : boost::statechart::state<ConstantHeading, Dive>,
      Notify<ConstantHeading, protobuf::IN_MISSION__UNDERWAY__TASK__DIVE__CONSTANT_HEADING,
             protobuf::SETPOINT_IVP_HELM>
{
    using StateBase = boost::statechart::state<ConstantHeading, Dive>;
    ConstantHeading(typename StateBase::my_context c);
    ~ConstantHeading();

    void loop(const EvLoop&);

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, ConstantHeading, &ConstantHeading::loop>>;

  private:
    goby::time::SteadyClock::time_point setpoint_stop_;
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
                         boost::statechart::transition<EvIMURestart, IMURestart>,
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

struct IMURestart
    : IMURestartCommon<IMURestart, Recovery, protobuf::IN_MISSION__UNDERWAY__RECOVERY__IMU_RESTART>
{
    IMURestart(typename StateBase::my_context c)
        : IMURestartCommon<IMURestart, Recovery,
                           protobuf::IN_MISSION__UNDERWAY__RECOVERY__IMU_RESTART>(c)
    {
    }
    ~IMURestart(){};

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvIMURestartCompleted, Transit>,
        boost::statechart::transition<EvIMURestartCompleted, StationKeep>,
        boost::statechart::in_state_reaction<EvLoop, IMURestartCommon, &IMURestartCommon::loop>>;
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
                         boost::statechart::transition<EvIMURestart, IMURestart>,
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

    void set_data_offload_percentage(const uint32_t& data_offload_percentage)
    {
        data_offload_percentage_ = data_offload_percentage;
    }
    uint32_t data_offload_percentage() const { return data_offload_percentage_; }

    void set_offload_command(const std::string& offload_command)
    {
        offload_command_ = offload_command;
    }
    std::string offload_command() const { return offload_command_; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvDataOffloadComplete, Idle>,
        boost::statechart::in_state_reaction<EvLoop, DataOffload, &DataOffload::loop>>;

  private:
    std::unique_ptr<std::thread> offload_thread_;
    // used by offload_thread_
    std::atomic<bool> offload_success_{false};
    std::atomic<bool> offload_complete_{false};
    std::string offload_command_{cfg().data_offload_command() + " 2>&1"};
    uint32_t data_offload_percentage_{0};
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

#include "jaiabot/intervehicle.h"

#include <goby/middleware/log/groups.h>
#include <goby/middleware/protobuf/logger.pb.h>

#include "machine.h"
#include "mission_manager.h"

using goby::glog;
namespace si = boost::units::si;
using boost::units::quantity;

jaiabot::protobuf::IvPBehaviorUpdate
create_transit_update(const jaiabot::protobuf::GeographicCoordinate& location,
                      quantity<si::velocity> speed, const goby::util::UTMGeodesy& geodesy,
                      const int& slip_radius)
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::TransitUpdate& transit = *update.mutable_transit();

    auto xy = geodesy.convert({location.lat_with_units(), location.lon_with_units()});

    transit.set_active(true);
    transit.set_x_with_units(xy.x);
    transit.set_y_with_units(xy.y);
    transit.set_speed_with_units(speed);
    transit.set_slip_radius(slip_radius);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

jaiabot::protobuf::IvPBehaviorUpdate create_location_stationkeep_update(
    const jaiabot::protobuf::GeographicCoordinate& location, quantity<si::velocity> transit_speed,
    quantity<si::velocity> outer_speed, const goby::util::UTMGeodesy& geodesy)
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::StationkeepUpdate& stationkeep =
        *update.mutable_stationkeep();

    stationkeep.set_active(true);

    auto xy = geodesy.convert({location.lat_with_units(), location.lon_with_units()});

    stationkeep.set_x_with_units(xy.x);
    stationkeep.set_y_with_units(xy.y);
    stationkeep.set_transit_speed_with_units(transit_speed);
    stationkeep.set_outer_speed_with_units(outer_speed);
    stationkeep.set_center_activate(false);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

jaiabot::protobuf::IvPBehaviorUpdate
create_center_activate_stationkeep_update(quantity<si::velocity> transit_speed,
                                          quantity<si::velocity> outer_speed)
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::StationkeepUpdate& stationkeep =
        *update.mutable_stationkeep();

    stationkeep.set_active(true);

    stationkeep.set_transit_speed_with_units(transit_speed);
    stationkeep.set_outer_speed_with_units(outer_speed);
    stationkeep.set_center_activate(true);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

jaiabot::protobuf::IvPBehaviorUpdate
create_constant_heading_update(quantity<si::plane_angle> heading)
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::ConstantHeadingUpdate& constantHeading =
        *update.mutable_constantheading();

    constantHeading.set_active(true);
    constantHeading.set_heading_with_units(heading);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

jaiabot::protobuf::IvPBehaviorUpdate create_constant_speed_update(quantity<si::velocity> speed)
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::ConstantSpeedUpdate& constantSpeed =
        *update.mutable_constantspeed();

    constantSpeed.set_active(true);
    constantSpeed.set_speed_with_units(speed);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

// PreDeployment::StartingUp
jaiabot::statechart::predeployment::StartingUp::StartingUp(typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point timeout_start = goby::time::SteadyClock::now();

    int timeout_seconds = cfg().startup_timeout_with_units<goby::time::SITime>().value();
    goby::time::SteadyClock::duration timeout_duration = std::chrono::seconds(timeout_seconds);
    timeout_stop_ = timeout_start + timeout_duration;

    // update which files are excluded from data offload
    switch (cfg().data_offload_exclude())
    {
        case config::MissionManager::GOBY:
            this->machine().set_data_offload_exclude(" '*.goby'");
            break;
        case config::MissionManager::TASKPACKET:
            this->machine().set_data_offload_exclude(" '*.taskpacket'");
            break;
        case config::MissionManager::NONE: this->machine().set_data_offload_exclude(""); break;
        default: this->machine().set_data_offload_exclude(""); break;
    }
}

jaiabot::statechart::predeployment::StartingUp::~StartingUp() {}

void jaiabot::statechart::predeployment::StartingUp::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= timeout_stop_)
        post_event(EvStartupTimeout());
}

// PreDeployment::Failed
jaiabot::statechart::predeployment::Failed::Failed(typename StateBase::my_context c) : StateBase(c)
{
    goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();

    // duration granularity is seconds
    int failed_startup_log_seconds = cfg().failed_startup_log_timeout();

    goby::time::SteadyClock::duration failed_startup_log_duration =
        std::chrono::seconds(failed_startup_log_seconds);

    failed_startup_log_timeout_ = start_timeout + failed_startup_log_duration;

    loop(EvLoop());
}

jaiabot::statechart::predeployment::Failed::~Failed()
{
    glog.is_verbose() && glog << "Start Logging" << std::endl;
    goby::middleware::protobuf::LoggerRequest request;
    request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
    interprocess().publish<goby::middleware::groups::logger_request>(request);
}

void jaiabot::statechart::predeployment::Failed::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    // make sure we have a safety timeout to transition into unpowered ascent
    if (current_clock >= failed_startup_log_timeout_)
    {
        glog.is_verbose() && glog << "Stop Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }
}

// PreDeployment::Idle
jaiabot::statechart::predeployment::Idle::Idle(typename StateBase::my_context c) : StateBase(c)
{
    if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
    {
        glog.is_verbose() && glog << "Stop Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }
}

jaiabot::statechart::predeployment::Idle::~Idle()
{
    if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
    {
        glog.is_verbose() && glog << "Start Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }
}

// Movement::Transit
jaiabot::statechart::inmission::underway::movement::Transit::Transit(
    typename StateBase::my_context c)
    : Base(c)
{
    boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();
    int slip_radius = cfg().waypoint_with_no_task_slip_radius();

    if (goal)
    {
        if (goal.get().has_task())
        {
            slip_radius = cfg().waypoint_with_task_slip_radius();
        }
        auto update = create_transit_update(
            goal->location(), this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().geodesy(), slip_radius);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }
    else
    {
        // Transit is called without a goal on the last return from Task
        // So if the mission has no goals, call ReturnToHome as this means it is the end of the
        // Transit mission
        glog.is_debug1() && glog << "Transit has no goal, recovering" << std::endl;
        post_event(EvReturnToHome());
    }
}

jaiabot::statechart::inmission::underway::movement::Transit::~Transit()
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    update.mutable_transit()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

// Recovery::Transit
jaiabot::statechart::inmission::underway::recovery::Transit::Transit(
    typename StateBase::my_context c)
    : Base(c)
{
    auto recovery = this->machine().mission_plan().recovery();
    jaiabot::protobuf::IvPBehaviorUpdate update;
    int slip_radius = cfg().waypoint_with_no_task_slip_radius();

    if (recovery.recover_at_final_goal())
    {
        auto final_goal = context<InMission>().final_goal();
        update = create_transit_update(final_goal.location(),
                                       this->machine().mission_plan().speeds().transit_with_units(),
                                       this->machine().geodesy(), slip_radius);
    }
    else
    {
        update = create_transit_update(recovery.location(),
                                       this->machine().mission_plan().speeds().transit_with_units(),
                                       this->machine().geodesy(), slip_radius);
    }
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

jaiabot::statechart::inmission::underway::recovery::Transit::~Transit()
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    update.mutable_transit()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

// Recovery::StationKeep
jaiabot::statechart::inmission::underway::recovery::StationKeep::StationKeep(
    typename StateBase::my_context c)
    : Base(c)
{
    auto recovery = this->machine().mission_plan().recovery();
    jaiabot::protobuf::IvPBehaviorUpdate update;
    if (recovery.recover_at_final_goal())
    {
        auto final_goal = context<InMission>().final_goal();
        update = create_location_stationkeep_update(
            final_goal.location(), this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().mission_plan().speeds().stationkeep_outer_with_units(),
            this->machine().geodesy());
    }
    else
    {
        update = create_location_stationkeep_update(
            recovery.location(), this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().mission_plan().speeds().stationkeep_outer_with_units(),
            this->machine().geodesy());
    }
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

jaiabot::statechart::inmission::underway::recovery::StationKeep::~StationKeep()
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::StationkeepUpdate& stationkeep =
        *update.mutable_stationkeep();

    stationkeep.set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

// Task

jaiabot::statechart::inmission::underway::Task::Task(typename StateBase::my_context c)
    : StateBase(c)
{
    goby::glog.is_debug2() && goby::glog << "Entering Task" << std::endl;
    auto perform_task_event = dynamic_cast<const EvPerformTask*>(triggering_event());
    if (perform_task_event && perform_task_event->has_task)
    {
        manual_task_ = perform_task_event->task;
        has_manual_task_ = true;
    }

    task_packet_.set_bot_id(cfg().bot_id());
    task_packet_.set_start_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    boost::optional<protobuf::MissionTask> current_task = context<Task>().current_task();
    task_packet_.set_type(current_task ? current_task->type() : protobuf::MissionTask::NONE);
}

jaiabot::statechart::inmission::underway::Task::~Task()
{
    auto task_complete_event = dynamic_cast<const EvTaskComplete*>(triggering_event());
    // each time we complete a autonomous task - we should increment the goal index
    // do not increment for other triggering events, such as EvIMURestart or EvGPSFix
    if (!has_manual_task_ && task_complete_event)
    {
        goby::glog.is_debug1() && goby::glog << "Increment Waypoint index" << std::endl;
        context<InMission>().increment_goal_index();
    }

    task_packet_.set_end_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

    if (task_packet_.type() == protobuf::MissionTask::DIVE ||
        task_packet_.type() == protobuf::MissionTask::SURFACE_DRIFT)
    {
        if (cfg().data_offload_exclude() != config::MissionManager::TASKPACKET)
        {
            // Convert to json string
            std::string json_string;
            google::protobuf::util::JsonPrintOptions json_options;
            // Set the snake_case option
            json_options.preserve_proto_field_names = true;

            google::protobuf::util::MessageToJsonString(task_packet_, &json_string, json_options);

            // Check if it is a new task packet file
            if (this->machine().create_task_packet_file())
            {
                this->machine().set_task_packet_file_name(cfg().interprocess().platform() + "_" +
                                                          this->machine().create_file_date_time() +
                                                          ".taskpacket");
                this->machine().set_create_task_packet_file(false);
            }
            else
            {
                json_string = "\n" + json_string;
            }

            // Open task packet file
            std::ofstream task_packet_file(
                cfg().log_dir() + "/" + this->machine().task_packet_file_name(), std::ios::app);

            task_packet_file << json_string;

            // Close the json file
            task_packet_file.close();
        }

        if (this->machine().rf_disable())
        {
            glog.is_debug2() && glog << "(RF Disabled) Publishing task packet interprocess: "
                                     << task_packet_.DebugString() << std::endl;
            interprocess().publish<groups::task_packet>(task_packet_);
        }
        else
        {
            glog.is_debug2() && glog << "(RF Enabled) Publishing task packet intervehicle: "
                                     << task_packet_.DebugString() << std::endl;
            intervehicle().publish<groups::task_packet>(
                task_packet_, intervehicle::default_publisher<protobuf::TaskPacket>);
        }
    }
}

// Task::Dive
jaiabot::statechart::inmission::underway::task::Dive::Dive(typename StateBase::my_context c)
    : StateBase(c)
{
    // we currently start at the surface
    quantity<si::length> depth = 0 * si::meters + current_dive().depth_interval_with_units();
    quantity<si::length> max_depth = current_dive().max_depth_with_units();

    // subtracting eps ensures we don't double up on the max_depth
    // when the interval divides evenly into max depth
    while (depth < max_depth - cfg().dive_depth_eps_with_units())
    {
        dive_depths_.push_back(depth);
        depth += current_dive().depth_interval_with_units();
    }
    // always add max_depth at the end
    dive_depths_.push_back(max_depth);
    dive_packet().set_depth_achieved(0);
    dive_packet().set_bottom_dive(false);

    glog.is_debug1() && glog << group("task") << "Dive::Dive Starting Bottom Type Sampling"
                             << std::endl;

    // Start bottom type sampling
    auto imu_command = IMUCommand();
    imu_command.set_type(IMUCommand::START_BOTTOM_TYPE_SAMPLING);
    this->interprocess().template publish<jaiabot::groups::imu>(imu_command);

    // Is this an echo task?
    bool start_echo_sensor = context<Task>().current_task()->start_echo();

    if (start_echo_sensor)
    {
        // Start echo recording
        auto echo_command = EchoCommand();
        echo_command.set_type(EchoCommand::CMD_START);
        this->interprocess().template publish<jaiabot::groups::echo>(echo_command);
    }
}

jaiabot::statechart::inmission::underway::task::Dive::~Dive()
{
    // compute dive rate based on dz / (sum of dt while in PoweredDescent)
    quantity<si::time> dt(dive_duration_);
    quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
    quantity<si::velocity> vz = dz / dt;
    dive_packet().set_dive_rate_with_units(vz);

    // ensure we don't exceed the bounds on the DCCL repeated field
    const auto max_measurement_size = dive_packet()
                                          .GetDescriptor()
                                          ->FindFieldByName("measurement")
                                          ->options()
                                          .GetExtension(dccl::field)
                                          .max_repeat();
    if (dive_packet().measurement_size() > max_measurement_size)
    {
        glog.is_warn() && glog << "Number of measurements (" << dive_packet().measurement_size()
                               << ") exceed DivePacket maximum of " << max_measurement_size
                               << ". Truncating." << std::endl;
        while (dive_packet().measurement_size() > max_measurement_size)
            dive_packet().mutable_measurement()->RemoveLast();
    }

    glog.is_debug1() && glog << group("task") << "Dive::~Dive() Stopping Bottom Type Sampling"
                             << std::endl;

    // Stop bottom type sampling
    auto imu_command = IMUCommand();
    imu_command.set_type(IMUCommand::STOP_BOTTOM_TYPE_SAMPLING);
    this->interprocess().template publish<jaiabot::groups::imu>(imu_command);

    // Is this an echo task?
    bool stop_echo_sensor = context<Task>().current_task()->start_echo();

    if (stop_echo_sensor)
    {
        // Stop echo recording
        auto echo_command = EchoCommand();
        echo_command.set_type(EchoCommand::CMD_STOP);
        this->interprocess().template publish<jaiabot::groups::echo>(echo_command);
    }
}

// Task::Dive::DivePrep
jaiabot::statechart::inmission::underway::task::dive::DivePrep::DivePrep(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();

    // duration granularity is seconds
    int dive_prep_timeout_seconds = cfg().dive_prep_timeout();

    goby::time::SteadyClock::duration dive_prep_duration =
        std::chrono::seconds(dive_prep_timeout_seconds);

    dive_prep_timeout_ = start_timeout + dive_prep_duration;

    // This makes sure we capture the pressure before the dive begins
    // Then we can adjust pressure accordingly
    this->machine().set_start_of_dive_pressure(this->machine().current_pressure());

    loop(EvLoop());
}

jaiabot::statechart::inmission::underway::task::dive::DivePrep::~DivePrep()
{
    if (machine().gps_tpv().has_location())
    {
        const auto& pos = machine().gps_tpv().location();
        auto& start = *context<Dive>().dive_packet().mutable_start_location();
        start.set_lat_with_units(pos.lat_with_units());
        start.set_lon_with_units(pos.lon_with_units());
    }
}

void jaiabot::statechart::inmission::underway::task::dive::DivePrep::loop(const EvLoop&)
{
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    if (current_clock >= dive_prep_timeout_)
    {
        glog.is_debug2() && glog << "DivePrep completed" << std::endl;
        post_event(EvDivePrepComplete());
    }
    else
    {
        glog.is_debug2() && glog << "Waiting for DivePrep to be completed" << std::endl;
    }
}

/**
 * @brief Check the pitch to determine if the bot is in it's veritical position.
 * It it is then we should exit DivePrep and begin our powered descent.
 * 
 * @param EvVehiclePitch 
 */
void jaiabot::statechart::inmission::underway::task::dive::DivePrep::pitch(const EvVehiclePitch& ev)
{
    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

    // If we are vertical then change to powered descent state
    if (std::abs(ev.pitch.value()) > cfg().pitch_to_determine_dive_prep_vertical())
    {
        // Check to see if we have reached the number of checks and the min check time
        // has been reach to determine if a bot is vertical
        if ((pitch_angle_check_incr_ >= (cfg().pitch_angle_checks() - 1)) &&
            ((now - last_pitch_dive_time_) >=
             static_cast<decltype(now)>(cfg().pitch_angle_min_check_time_with_units())))
        {
            glog.is_warn() && glog << "DivePrep::pitch Bot is vertical!"
                                   << "\npost_event(EvDivePrepComplete());" << std::endl;
            post_event(EvDivePrepComplete());
        }
        pitch_angle_check_incr_++;
    }
    else
    {
        last_pitch_dive_time_ = now;
        pitch_angle_check_incr_ = 0;
    }
}

// Task::Dive::PoweredDescent
jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::PoweredDescent(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();
    // duration granularity is seconds
    int detect_bottom_logic_timeout_seconds = cfg().detect_bottom_logic_init_timeout();

    // Keep track if the bot has already had a hold
    // We need to adjust our bottom logic timeout
    if (context<Dive>().has_bot_performed_a_hold())
    {
        detect_bottom_logic_timeout_seconds = cfg().detect_bottom_logic_after_hold_timeout();
    }

    // duration granularity is seconds
    int powered_descent_timeout_seconds = cfg().powered_descent_timeout();

    goby::time::SteadyClock::duration detect_bottom_logic_duration =
        std::chrono::seconds(detect_bottom_logic_timeout_seconds);

    goby::time::SteadyClock::duration powered_descent_timeout_duration =
        std::chrono::seconds(powered_descent_timeout_seconds);

    detect_bottom_logic_timeout_ = start_timeout + detect_bottom_logic_duration;

    powered_descent_timeout_ = start_timeout + powered_descent_timeout_duration;
}

jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::~PoweredDescent()
{
    goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime dt(end_time - start_time_ - duration_correction_);
    context<Dive>().add_to_dive_duration(dt);
}

void jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    // Check when to stop logging
    if (current_clock >= powered_descent_timeout_)
    {
        glog.is_debug2() && glog << "Safety Powered Descent Timeout!" << std::endl;
        post_event(EvPowerDescentSafety());
    }
    else
    {
        glog.is_debug2() && glog << "Safety Powered Descent Timeout Not Reached!" << std::endl;
    }
}

/**
 * @brief Executes when the bot receives a new depth reading so that the bot can 
 *        determine if it has reached its goal depth 
 * 
 * @param ev Depth event used to pass the new depth reading
 */
void jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth(
    const EvVehicleDepth& ev)
{
    glog.is_debug1() &&
        glog << "Entered "
                "jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth: \n"
             << std::endl;

    // Desired setpoint command
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_DIVE);

    // keep track of dive information
    jaiabot::protobuf::DivePowerDescentDebug dive_pdescent_debug;

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    // Set Current Depth
    context<Dive>().set_current_depth(ev.depth);

    // check needed to initially set the last_depth to the current one
    if (is_initial_depth_reading_)
    {
        last_depth_ = ev.depth;
        is_initial_depth_reading_ = false;
    }

    dive_pdescent_debug.set_current_depth(ev.depth.value());
    dive_pdescent_debug.set_goal_depth(context<Dive>().goal_depth().value());
    dive_pdescent_debug.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
    dive_pdescent_debug.set_last_depth(last_depth_.value());
    dive_pdescent_debug.set_last_depth_change_time(last_depth_change_time_.value());
    dive_pdescent_debug.set_bottoming_timeout_with_units(cfg().bottoming_timeout_with_units());

    glog.is_debug1() &&
        glog << "(boost::units::abs(ev.depth - context<Dive>().goal_depth()) < "
                "cfg().dive_depth_eps_with_units()): "
             << (boost::units::abs(ev.depth - context<Dive>().goal_depth()) <
                 cfg().dive_depth_eps_with_units())
             << "\n ev.depth: " << ev.depth.value()
             << "\n context<Dive>().goal_depth(): " << context<Dive>().goal_depth().value()
             << "\n cfg().dive_depth_eps: " << cfg().dive_depth_eps()
             << "\n ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units()): "
             << ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units())
             << "\n ((ev.depth - last_depth_) > "
                "cfg().dive_eps_to_determine_diving_with_units()): "
             << ((ev.depth - last_depth_) > cfg().dive_eps_to_determine_diving_with_units())
             << "\n ev.depth: " << ev.depth.value() << "\n last_depth_" << last_depth_.value()
             << "\n cfg().dive_depth_eps: " << cfg().dive_depth_eps()
             << "\n cfg().dive_eps_to_determine_diving: " << cfg().dive_eps_to_determine_diving()
             << "\n Intial Timeout complete: " << (current_clock >= detect_bottom_logic_timeout_)
             << "\n Is bot diving: " << is_bot_diving_
             << "\n (now - last_depth_change_time_) >"
                "static_cast<decltype(now)>(cfg().bottoming_timeout_with_units())"
             << ((now - last_depth_change_time_) >
                 static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()))
             << std::endl;

    if (boost::units::abs(ev.depth - context<Dive>().goal_depth()) <
        cfg().dive_depth_eps_with_units())
    {
        // Set depth achieved if we have reached our goal depth
        context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);
        dive_pdescent_debug.set_depth_reached(true);
        post_event(EvDepthTargetReached());
    }

    // if we've moved eps meters in depth, then we consider the bot to be diving
    // and check if we already determined the bot is diving
    if ((ev.depth - last_depth_) > cfg().dive_eps_to_determine_diving_with_units() &&
        !is_bot_diving_)
    {
        last_depth_change_time_ = now;
        last_depth_ = ev.depth;
        dive_pdescent_debug.set_bot_is_diving(true);
        is_bot_diving_ = true;
    }

    // Check if our initial timeout has been reached to detect bottom
    // or if the bot is diving.
    if (current_clock >= detect_bottom_logic_timeout_ || is_bot_diving_)
    {
        // if we've moved eps meters in depth, reset the timer for determining hitting the seafloor
        if ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units())
        {
            last_depth_change_time_ = now;
            last_depth_ = ev.depth;
            dive_pdescent_debug.set_depth_changed(true);
        }

        // assume we've hit the bottom if the depth isn't changing for bottoming timeout seconds
        if ((now - last_depth_change_time_) >
            static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()))
        {
            context<Dive>().set_seafloor_reached(ev.depth);

            // Set depth achieved if we had a bottoming timeout
            context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);

            // Set the max_acceration
            context<Dive>().dive_packet().set_max_acceleration_with_units(
                this->machine().latest_max_acceleration());

            // Determine Hard/Soft
            if (this->machine().latest_max_acceleration().value() >=
                cfg().hard_bottom_type_acceleration())
            {
                // Set the bottom_type Hard
                context<Dive>().dive_packet().set_bottom_type(
                    protobuf::DivePacket::BottomType::DivePacket_BottomType_HARD);
            }
            else
            {
                // Set the bottom_type Soft
                context<Dive>().dive_packet().set_bottom_type(
                    protobuf::DivePacket::BottomType::DivePacket_BottomType_SOFT);
            }

            // used to correct dive rate calculation
            duration_correction_ = (now - last_depth_change_time_);
            post_event(EvDepthTargetReached());
            dive_pdescent_debug.set_depth_change_timeout(true);
        }
    }

    interprocess().publish<jaiabot::groups::mission_dive>(dive_pdescent_debug);

    // If bot is diving
    // or if we are going back into powered descent after a hold at a depth
    // or if we are in sim
    // Then use PID
    if (is_bot_diving_ || context<Dive>().has_bot_performed_a_hold() || cfg().is_sim())
    {
        setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
    }

    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    glog.is_debug1() &&
        glog << "Exit jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth: "
                "\n"
             << std::endl;
}

// Task::Dive::Hold
jaiabot::statechart::inmission::underway::task::dive::Hold::Hold(typename StateBase::my_context c)
    : StateBase(c), measurement_(*context<Dive>().dive_packet().add_measurement())
{
    goby::time::SteadyClock::time_point hold_start = goby::time::SteadyClock::now();
    // duration granularity is seconds
    int hold_seconds =
        context<Dive>().current_dive().hold_time_with_units<goby::time::SITime>().value();

    goby::time::SteadyClock::duration hold_duration = std::chrono::seconds(hold_seconds);
    hold_stop_ = hold_start + hold_duration;

    // Keep track if the bot has already had a hold
    // We need to adjust our bottom logic timeout
    // If we go back into powered descent
    if (!context<Dive>().has_bot_performed_a_hold())
    {
        context<Dive>().set_bot_performed_a_hold(true);
    }

    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_DIVE);
    setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
}

jaiabot::statechart::inmission::underway::task::dive::Hold::~Hold()
{
    // compute stats for DivePacket
    if (!depths_.empty())
    {
        quantity<si::length> d_mean(0 * si::meters);
        for (const auto& d : depths_) d_mean += d;
        d_mean /= static_cast<double>(depths_.size());
        measurement_.set_mean_depth_with_units(d_mean);
    }

    if (!temperatures_.empty())
    {
        double t_mean(0);
        // can't sum absolute temperatures, so strip off the units while we do the mean calculation
        for (const auto& t : temperatures_) t_mean += t.value();

        t_mean /= static_cast<double>(temperatures_.size());
        measurement_.set_mean_temperature_with_units(
            t_mean * boost::units::absolute<boost::units::celsius::temperature>());
    }

    if (!salinities_.empty())
    {
        double s_mean(0);
        for (const auto& s : salinities_) s_mean += s;
        s_mean /= static_cast<double>(salinities_.size());
        measurement_.set_mean_salinity(s_mean);
    }
}

void jaiabot::statechart::inmission::underway::task::dive::Hold::loop(const EvLoop&)
{
    glog.is_debug1() &&
        glog << "Entered jaiabot::statechart::inmission::underway::task::dive::Hold::loop: \n"
             << std::endl;

    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

    //Keep track of dive information
    jaiabot::protobuf::DiveHoldDebug dive_hold_debug;

    dive_hold_debug.set_hold_timeout(hold_stop_.time_since_epoch().count());

    glog.is_debug2() && glog << "if (now >= hold_stop_): " << (now >= hold_stop_)
                             << "\n Current Time: " << now.time_since_epoch().count()
                             << "\n Hold Timeout: " << hold_stop_.time_since_epoch().count() << "\n"
                             << std::endl;

    if (now >= hold_stop_)
    {
        context<Dive>().pop_goal_depth();
        if (context<Dive>().dive_complete())
        {
            glog.is_debug2() && glog << "context<Dive>().dive_complete() == true"
                                     << "\n post_event(EvDiveComplete())" << std::endl;
            post_event(EvDiveComplete());
            dive_hold_debug.set_dive_complete(true);
        }
        else
        {
            glog.is_debug2() && glog << "context<Dive>().dive_complete() == false"
                                     << "\n post_event(EvHoldComplete())" << std::endl;
            post_event(EvHoldComplete());
            dive_hold_debug.set_hold_complete(true);
        }
    }
    interprocess().publish<jaiabot::groups::mission_dive>(dive_hold_debug);
    glog.is_debug1() &&
        glog << "Exit jaiabot::statechart::inmission::underway::task::dive::Hold::loop: \n"
             << std::endl;
}

void jaiabot::statechart::inmission::underway::task::dive::Hold::measurement(
    const EvMeasurement& ev)
{
    if (ev.temperature)
        temperatures_.push_back(ev.temperature.get());
    if (ev.salinity)
        salinities_.push_back(ev.salinity.get());
}

void jaiabot::statechart::inmission::underway::task::dive::Hold::depth(const EvVehicleDepth& ev)
{
    glog.is_debug1() &&
        glog << "Entered jaiabot::statechart::inmission::underway::task::dive::Hold::depth: \n"
             << std::endl;

    //Keep track of dive information
    jaiabot::protobuf::DiveHoldDebug dive_hold_debug;

    // Set Current Depth
    context<Dive>().set_current_depth(ev.depth);

    glog.is_debug2() &&
        glog << "if (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units()): "
             << (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units())
             << "\n ev.depth: " << ev.depth.value()
             << "\n context<Dive>().dive_packet().depth_achieved_with_units(): "
             << context<Dive>().dive_packet().depth_achieved_with_units().value() << "\n"
             << std::endl;
    if (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units())
    {
        context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);
    }

    depths_.push_back(ev.depth);

    dive_hold_debug.set_current_depth(ev.depth.value());
    interprocess().publish<jaiabot::groups::mission_dive>(dive_hold_debug);

    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_DIVE);
    setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    glog.is_debug1() &&
        glog << "Exit jaiabot::statechart::inmission::underway::task::dive::Hold::depth: \n"
             << std::endl;
}

// Task::Dive::UnpoweredAscent
jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::UnpoweredAscent(
    typename StateBase::my_context c)
    : StateBase(c)
{
    loop(EvLoop());
}

jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::~UnpoweredAscent()
{
    goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
    quantity<si::time> dt(end_time - start_time_);
    quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
    quantity<si::velocity> vz = dz / dt;
    double rise_rate = vz.value();

    if (context<Dive>().dive_packet().has_powered_rise_rate())
    {
        rise_rate = (context<Dive>().dive_packet().powered_rise_rate() + vz.value()) / 2;
    }

    context<Dive>().dive_packet().set_unpowered_rise_rate_with_units(rise_rate *
                                                                     boost::units::si::velocity());
}

void jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::loop(const EvLoop&)
{
    glog.is_debug1() &&
        glog << "Entered "
                "jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::loop: \n"
             << std::endl;
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
}

void jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth(
    const EvVehicleDepth& ev)
{
    glog.is_debug1() &&
        glog << "Entered "
                "jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth: \n"
             << std::endl;

    //Keep track of dive information
    jaiabot::protobuf::DiveUnpoweredAscentDebug dive_uascent_debug;

    // Set Current Depth
    context<Dive>().set_current_depth(ev.depth);

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

    glog.is_debug1() &&
        glog << "if (ev.depth < cfg().dive_surface_eps_with_units()): "
             << (ev.depth < cfg().dive_surface_eps_with_units())
             << "\n ev.depth: " << ev.depth.value() << "\n last_depth_: " << last_depth_.value()
             << "\n is current depth less than last_depth: " << (ev.depth < last_depth_)
             << "\n is the current depth - last_depth: " << (ev.depth - last_depth_).value()
             << "\n is it greater than eps: "
             << (std::abs((ev.depth - last_depth_).value()) > cfg().dive_depth_eps())
             << "\n is the current depth lest than the last: " << (ev.depth < last_depth_)
             << "\n cfg().dive_surface_eps: " << cfg().dive_depth_eps() << "\n"
             << std::endl;

    // within surface eps of the surface (or any negative value)
    if (ev.depth < cfg().dive_surface_eps_with_units())
    {
        post_event(EvSurfaced());
        dive_uascent_debug.set_surfaced(true);
    }

    // if we've moved eps meters in depth, reset the timer for determining if we
    // are stuck underwater
    // Also make sure we are moving towards surface
    if (std::abs((ev.depth - last_depth_).value()) > cfg().dive_depth_eps() &&
        (ev.depth < last_depth_))
    {
        last_depth_change_time_ = now;
        last_depth_ = ev.depth;
    }

    // assume we are stuck if the depth isn't changing
    if ((now - last_depth_change_time_) >
        static_cast<decltype(now)>(cfg().bot_not_rising_timeout_with_units()))
    {
        glog.is_debug1() &&
            glog << "UnpoweredAscent::depth we are not changing depth! We might be stuck!"
                 << "\n"
                 << std::endl;

        post_event(EvSurfacingTimeout());
    }

    dive_uascent_debug.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
    dive_uascent_debug.set_current_depth(ev.depth.value());
    interprocess().publish<jaiabot::groups::mission_dive>(dive_uascent_debug);
    glog.is_debug1() &&
        glog << "Exit "
                "jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth: \n"
             << std::endl;
}

// Task::Dive::PoweredAscent
jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::PoweredAscent(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();

    powered_ascent_motor_on_timeout_ = start_timeout + powered_ascent_motor_on_duration_;

    powered_ascent_motor_off_timeout_ = start_timeout + powered_ascent_motor_off_duration_;

    loop(EvLoop());
}

// Task::Dive::PoweredAscent
jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::~PoweredAscent()
{
    goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
    quantity<si::time> dt(end_time - start_time_);
    quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
    quantity<si::velocity> vz = dz / dt;
    double rise_rate = vz.value();

    if (context<Dive>().dive_packet().has_powered_rise_rate())
    {
        rise_rate = (context<Dive>().dive_packet().powered_rise_rate() + vz.value()) / 2;
    }

    context<Dive>().dive_packet().set_powered_rise_rate_with_units(rise_rate *
                                                                   boost::units::si::velocity());
}

void jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::loop(const EvLoop&)
{
    protobuf::DesiredSetpoints setpoint_msg;
    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    // ***************************************************
    // this logic turns the motor off and on
    // while in powered descent to help assist the vehicle
    // to get out of muddy bottoms
    // ***************************************************

    // we have timedout on motor on
    // and we are not currently in motor off,
    // turn off motor
    if (current_clock >= powered_ascent_motor_on_timeout_ && !in_motor_off_mode_)
    {
        glog.is_debug1() && glog << "Powered Ascent: Turn off motor, we have timed out on motor on!"
                                 << std::endl;

        // Check to see if the duration for motor on is still under max
        if (powered_ascent_motor_on_duration_ < std::chrono::seconds(cfg().motor_on_time_max()))
        {
            // Increment motor on duration
            powered_ascent_motor_on_duration_ +=
                std::chrono::seconds(cfg().motor_on_time_increment());
        }

        if (powered_ascent_throttle_ < cfg().powered_ascent_throttle_max())
        {
            // Increase powered ascent throttle
            powered_ascent_throttle_ += cfg().powered_ascent_throttle_increment();
        }

        glog.is_debug1() &&
            glog << "PoweredAscent::depth Duration: " << powered_ascent_motor_on_duration_.count()
                 << "\n"
                 << "PoweredAscent::depth Throttle: " << powered_ascent_throttle_ << "\n"
                 << std::endl;

        powered_ascent_motor_off_timeout_ = current_clock + powered_ascent_motor_off_duration_;
        in_motor_off_mode_ = true;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    }
    // we have not timedout on motor on
    else if (current_clock < powered_ascent_motor_on_timeout_)
    {
        glog.is_debug1() && glog << "Powered Ascent: Leave motor running, we have not timed out!"
                                 << std::endl;
        setpoint_msg.set_type(protobuf::SETPOINT_POWERED_ASCENT);
        setpoint_msg.set_throttle(powered_ascent_throttle_);
    }
    // we have timedout on motor off,
    // turn on motor
    else if (current_clock >= powered_ascent_motor_off_timeout_)
    {
        glog.is_debug1() && glog << "Powered Ascent: Turn on motor, we have timed out on motor off!"
                                 << std::endl;
        powered_ascent_motor_on_timeout_ = current_clock + powered_ascent_motor_on_duration_;
        in_motor_off_mode_ = false;
        setpoint_msg.set_type(protobuf::SETPOINT_POWERED_ASCENT);
        setpoint_msg.set_throttle(powered_ascent_throttle_);
    }
    // we have not timedout on motor off
    else if (current_clock < powered_ascent_motor_off_timeout_)
    {
        glog.is_debug1() && glog << "Powered Ascent: Leave motor off, we have not timed out!"
                                 << std::endl;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    }

    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
}

void jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::depth(
    const EvVehicleDepth& ev)
{
    glog.is_debug1() &&
        glog << "Entered "
                "jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::depth: \n"
             << std::endl;

    // keep track of dive information
    jaiabot::protobuf::DivePoweredAscentDebug dive_pascent_debug;

    // Set Current Depth
    context<Dive>().set_current_depth(ev.depth);

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

    glog.is_debug1() && glog << "if (ev.depth < cfg().dive_surface_eps_with_units()): "
                             << (ev.depth < cfg().dive_surface_eps_with_units())
                             << "\n ev.depth: " << ev.depth.value()
                             << "\n cfg().dive_surface_eps(): " << cfg().dive_surface_eps() << "\n"
                             << std::endl;

    // within surface eps of the surface (or any negative value)
    if (ev.depth < cfg().dive_surface_eps_with_units())
    {
        post_event(EvSurfaced());
        dive_pascent_debug.set_surfaced(true);
    }

    // if we've moved eps meters in depth, reset the timer for determining if we
    // are stuck underwater
    // Also make sure we are moving towards surface
    if (std::abs((ev.depth - last_depth_).value()) > cfg().dive_depth_eps() &&
        (ev.depth < last_depth_))
    {
        glog.is_debug1() && glog << "PoweredAscent::depth we are changing depth!"
                                 << "\n"
                                 << std::endl;
        last_depth_change_time_ = now;
        last_depth_ = ev.depth;
        post_event(EvDiveRising());
    }

    // assume we are stuck if the depth isn't changing for bot not rising timeout seconds
    if ((now - last_depth_change_time_) >
        static_cast<decltype(now)>(cfg().bot_not_rising_timeout_with_units()))
    {
        glog.is_debug1() &&
            glog << "PoweredAscent::depth we are not changing depth! We might be stuck!"
                 << "\n"
                 << std::endl;
    }

    dive_pascent_debug.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
    dive_pascent_debug.set_current_depth(ev.depth.value());
    interprocess().publish<jaiabot::groups::mission_dive>(dive_pascent_debug);
    glog.is_debug1() &&
        glog
            << "Exit jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::depth: \n"
            << std::endl;
}

void jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::pitch(
    const EvVehiclePitch& ev)
{
    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();

    // If we are not vertical then change to reacquire gps state.
    // We are most likey driving on the surface, possible pressure sensor error
    if (std::abs(ev.pitch.value()) <= cfg().pitch_to_determine_powered_ascent_vertical())
    {
        // Check to see if we have reached the number of checks and the min check time
        // has been reach to determine if a bot is no longer vertical
        if ((pitch_angle_check_incr_ >= (cfg().pitch_angle_checks() - 1)) &&
            ((now - last_pitch_dive_time_) >=
             static_cast<decltype(now)>(cfg().pitch_angle_min_check_time_with_units())))
        {
            glog.is_warn() && glog << "PoweredAscent::pitch Bot is no longer vertical!"
                                   << "\npost_event(EvBotNotVertical());" << std::endl;
            post_event(EvBotNotVertical());
        }
        pitch_angle_check_incr_++;
    }
    else
    {
        last_pitch_dive_time_ = now;
        pitch_angle_check_incr_ = 0;
    }
}

// Movement::SurfTransit
jaiabot::statechart::inmission::underway::task::ConstantHeading::ConstantHeading(
    typename StateBase::my_context c)
    : StateBase(c)
{
    boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();

    boost::units::quantity<boost::units::si::plane_angle> heading(
        (goal.get().task().constant_heading().constant_heading() * boost::units::degree::degrees));

    boost::units::quantity<boost::units::si::velocity> speed(
        (goal.get().task().constant_heading().constant_heading_speed() *
         boost::units::si::meters_per_second));

    jaiabot::protobuf::IvPBehaviorUpdate constantHeadingUpdate;
    jaiabot::protobuf::IvPBehaviorUpdate constantSpeedUpdate;

    constantHeadingUpdate = create_constant_heading_update(heading);
    constantSpeedUpdate = create_constant_speed_update(speed);

    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);

    goby::time::SteadyClock::time_point setpoint_start = goby::time::SteadyClock::now();
    int setpoint_seconds = goal.get().task().constant_heading().constant_heading_time();
    goby::time::SteadyClock::duration setpoint_duration = std::chrono::seconds(setpoint_seconds);
    setpoint_stop_ = setpoint_start + setpoint_duration;

    // Turn on pid for constant heading (different than the transit pid)
    context<InMission>().set_use_heading_constant_pid(true);
}

jaiabot::statechart::inmission::underway::task::ConstantHeading::~ConstantHeading()
{
    jaiabot::protobuf::IvPBehaviorUpdate constantHeadingUpdate;
    jaiabot::protobuf::IvPBehaviorUpdate constantSpeedUpdate;
    constantHeadingUpdate.mutable_constantheading()->set_active(false);
    constantSpeedUpdate.mutable_constantspeed()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);

    // Turn off pid for constant heading (different than the transit pid)
    context<InMission>().set_use_heading_constant_pid(false);
}

void jaiabot::statechart::inmission::underway::task::ConstantHeading::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= setpoint_stop_)
        post_event(EvTaskComplete());
}

// Pause::ReacquireGPS
jaiabot::statechart::inmission::pause::ReacquireGPS::ReacquireGPS(typename StateBase::my_context c)
    : StateBase(c)
{
    if (this->app().is_test_mode(config::MissionManager::ENGINEERING_TEST__INDOOR_MODE__NO_GPS))
    {
        // in indoor mode, simply post that we've received a fix
        // (even though we haven't as there's no GPS)
        post_event(statechart::EvGPSFix());
    }
    else
    {
        this->machine().insert_warning(jaiabot::protobuf::WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
    }
}

// Pause::ResolveNoForwardProgress
jaiabot::statechart::inmission::pause::ResolveNoForwardProgress::ResolveNoForwardProgress(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point resolve_start = goby::time::SteadyClock::now();
    auto resume_duration = goby::time::convert_duration<goby::time::SteadyClock::duration>(
        cfg().resolve_no_forward_progress().resume_timeout_with_units());
    resume_timeout_ = resolve_start + resume_duration;
}

void jaiabot::statechart::inmission::pause::ResolveNoForwardProgress::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

    // for now, simply wait a period of time and then resume
    if (now >= resume_timeout_)
    {
        post_event(EvForwardProgressResolved());
    }
}

jaiabot::statechart::inmission::pause::ResolveNoForwardProgress::~ResolveNoForwardProgress()
{
    this->machine().erase_warning(jaiabot::protobuf::WARNING__VEHICLE__NO_FORWARD_PROGRESS);
}

// Dive::ReacquireGPS
jaiabot::statechart::inmission::underway::task::dive::ReacquireGPS::ReacquireGPS(
    typename StateBase::my_context c)
    : StateBase(c)
{
    if (this->app().is_test_mode(config::MissionManager::ENGINEERING_TEST__INDOOR_MODE__NO_GPS))
    {
        // in indoor mode, simply post that we've received a fix
        // (even though we haven't as there's no GPS)
        post_event(statechart::EvGPSFix());
    }
    else
    {
        this->machine().insert_warning(jaiabot::protobuf::WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
    }
}

jaiabot::statechart::inmission::underway::task::dive::ReacquireGPS::~ReacquireGPS()
{
    end_time_ = goby::time::SystemClock::now<goby::time::MicroTime>();
    context<Dive>().dive_packet().set_duration_to_acquire_gps_with_units(end_time_ - start_time_);
    this->machine().erase_warning(jaiabot::protobuf::WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
}

// Task::StationKeep
jaiabot::statechart::inmission::underway::task::StationKeep::StationKeep(
    typename StateBase::my_context c)
    : Base(c)
{
    boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();

    jaiabot::protobuf::IvPBehaviorUpdate update;

    // if we have a defined location in the goal
    if (goal)
        update = create_location_stationkeep_update(
            goal->location(), this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().mission_plan().speeds().stationkeep_outer_with_units(),
            this->machine().geodesy());
    else // just use our current position
        update = create_center_activate_stationkeep_update(
            this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().mission_plan().speeds().stationkeep_outer_with_units());

    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);

    goby::time::SteadyClock::time_point setpoint_start = goby::time::SteadyClock::now();
    int setpoint_seconds = goal.get().task().station_keep().station_keep_time();
    goby::time::SteadyClock::duration setpoint_duration = std::chrono::seconds(setpoint_seconds);
    setpoint_stop_ = setpoint_start + setpoint_duration;
}

void jaiabot::statechart::inmission::underway::task::StationKeep::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= setpoint_stop_)
        post_event(EvTaskComplete());
}

// Dive::ConstantHeading
jaiabot::statechart::inmission::underway::task::dive::ConstantHeading::ConstantHeading(
    typename StateBase::my_context c)
    : StateBase(c)
{
    boost::units::quantity<boost::units::si::plane_angle> heading(
        (this->machine().bottom_depth_safety_constant_heading() * boost::units::degree::degrees));

    boost::units::quantity<boost::units::si::velocity> speed(
        (this->machine().bottom_depth_safety_constant_heading_speed() *
         boost::units::si::meters_per_second));

    jaiabot::protobuf::IvPBehaviorUpdate constantHeadingUpdate;
    jaiabot::protobuf::IvPBehaviorUpdate constantSpeedUpdate;

    constantHeadingUpdate = create_constant_heading_update(heading);
    constantSpeedUpdate = create_constant_speed_update(speed);

    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);

    goby::time::SteadyClock::time_point setpoint_start = goby::time::SteadyClock::now();
    int setpoint_seconds = this->machine().bottom_depth_safety_constant_heading_time();
    goby::time::SteadyClock::duration setpoint_duration = std::chrono::seconds(setpoint_seconds);
    setpoint_stop_ = setpoint_start + setpoint_duration;
}

jaiabot::statechart::inmission::underway::task::dive::ConstantHeading::~ConstantHeading()
{
    jaiabot::protobuf::IvPBehaviorUpdate constantHeadingUpdate;
    jaiabot::protobuf::IvPBehaviorUpdate constantSpeedUpdate;
    constantHeadingUpdate.mutable_constantheading()->set_active(false);
    constantSpeedUpdate.mutable_constantspeed()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);
}

void jaiabot::statechart::inmission::underway::task::dive::ConstantHeading::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= setpoint_stop_)
        post_event(EvTaskComplete());
}

jaiabot::statechart::inmission::underway::task::StationKeep::~StationKeep()
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    update.mutable_stationkeep()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

boost::statechart::result
jaiabot::statechart::inmission::underway::movement::remotecontrol::RemoteControlEndSelection::react(
    const EvRCEndSelect&)
{
    switch (this->cfg().rc_setpoint_end())
    {
        case config::MissionManager::RC_SETPOINT_ENDS_IN_STATIONKEEP: return transit<StationKeep>();
        case config::MissionManager::RC_SETPOINT_ENDS_IN_SURFACE_DRIFT:
            return transit<SurfaceDrift>();
    }

    // should never reach here but if does, abort the mission
    return transit<underway::Abort>();
}

// Movement::RemoteControl::StationKeep
jaiabot::statechart::inmission::underway::movement::remotecontrol::StationKeep::StationKeep(
    typename StateBase::my_context c)
    : Base(c)
{
    jaiabot::protobuf::IvPBehaviorUpdate update = create_center_activate_stationkeep_update(
        this->machine().mission_plan().speeds().transit_with_units(),
        this->machine().mission_plan().speeds().stationkeep_outer_with_units());
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

jaiabot::statechart::inmission::underway::movement::remotecontrol::StationKeep::~StationKeep()
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    update.mutable_stationkeep()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

void jaiabot::statechart::inmission::underway::movement::remotecontrol::SurfaceDrift::loop(
    const EvLoop&)
{
}

// Movement::RemoteControl::Setpoint
jaiabot::statechart::inmission::underway::movement::remotecontrol::Setpoint::Setpoint(
    typename StateBase::my_context c)
    : StateBase(c)
{
    auto rc_setpoint_event = dynamic_cast<const EvRCSetpoint*>(triggering_event());
    if (rc_setpoint_event)
    {
        rc_setpoint_ = rc_setpoint_event->rc_setpoint;
    }

    goby::time::SteadyClock::time_point setpoint_start = goby::time::SteadyClock::now();
    int setpoint_seconds = rc_setpoint_.duration_with_units<goby::time::SITime>().value();
    goby::time::SteadyClock::duration setpoint_duration = std::chrono::seconds(setpoint_seconds);
    setpoint_stop_ = setpoint_start + setpoint_duration;
}

void jaiabot::statechart::inmission::underway::movement::remotecontrol::Setpoint::loop(
    const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= setpoint_stop_)
        post_event(EvRCSetpointComplete());

    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_REMOTE_CONTROL);
    *setpoint_msg.mutable_remote_control() = rc_setpoint_;
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
}

jaiabot::statechart::inmission::underway::recovery::Stopped::Stopped(
    typename StateBase::my_context c)
    : StateBase(c)
{
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    this->machine().erase_warning(jaiabot::protobuf::WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
}

// PostDeployment::DataOffload
jaiabot::statechart::postdeployment::DataOffload::DataOffload(typename StateBase::my_context c)
    : StateBase(c)
{
    glog.is_verbose() && glog << "Stop Logging" << std::endl;
    goby::middleware::protobuf::LoggerRequest request;
    request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
    request.set_close_log(true);
    interprocess().publish<goby::middleware::groups::logger_request>(request);

    if (cfg().data_offload_exclude() != config::MissionManager::TASKPACKET)
    {
        // Reset if recovered
        // If bot is activated again and more task packets
        // are received, then the bot will create a new file
        // to log them
        this->machine().set_create_task_packet_file(true);
    }

    // run preoffload script and then do nothing (actual offload handled by jaiabot_hub_manager)
    if (!run_command(CommandType::PRE_OFFLOAD))
    {
        glog.is_warn() && glog << "Pre offload command Failed" << std::endl;
        this->machine().insert_warning(
            jaiabot::protobuf::WARNING__MISSION__DATA_PRE_OFFLOAD_FAILED);
        post_event(EvDataOffloadFailed());
    }
    else
    {
        glog.is_warn() && glog << "Pre offload command Succeeded" << std::endl;
        this->machine().erase_warning(jaiabot::protobuf::WARNING__MISSION__DATA_PRE_OFFLOAD_FAILED);
    }
}

bool jaiabot::statechart::postdeployment::DataOffload::run_command(CommandType type)
{
    std::string human_command_type;
    std::string command;
    bool success = false;

    if (type == CommandType::PRE_OFFLOAD)
    {
        human_command_type = "pre-data offload";
        command = cfg().data_preoffload_script() + " " + cfg().log_dir() + " " +
                  cfg().log_staging_dir() + this->machine().data_offload_exclude() + " 2>&1";
    }
    else if (type == CommandType::POST_OFFLOAD)
    {
        human_command_type = "post-data offload";
        command = cfg().data_postoffload_script() + " " + cfg().log_dir() + " " +
                  cfg().log_staging_dir() + " " + cfg().log_archive_dir() + " 2>&1";
    }

    glog.is_debug1() && glog << "Performing " << human_command_type << " with command: [" << command
                             << "]" << std::endl;

    FILE* pipe = popen(command.c_str(), "r");
    if (!pipe)
    {
        glog.is_warn() && glog << "Error opening pipe to " << human_command_type
                               << " command: " << strerror(errno) << std::endl;
    }
    else
    {
        std::string stdout;
        std::array<char, 256> buffer;
        while (auto bytes_read = fread(buffer.data(), sizeof(char), buffer.size(), pipe))
        {
            glog.is_debug1() && glog << std::string(buffer.begin(), buffer.begin() + bytes_read)
                                     << std::flush;
            stdout.append(buffer.begin(), buffer.begin() + bytes_read);
        }

        if (!feof(pipe))
        {
            pclose(pipe);
            glog.is_warn() && glog << "Error reading output while executing " << human_command_type
                                   << " command" << std::endl;
        }
        else
        {
            int status = pclose(pipe);
            if (status < 0)
            {
                glog.is_warn() && glog << "Error executing  " << human_command_type
                                       << " command: " << strerror(errno) << ", output: " << stdout
                                       << std::endl;
            }
            else
            {
                if (WIFEXITED(status))
                {
                    int exit_status = WEXITSTATUS(status);
                    if (exit_status == 0)
                        success = true;
                    else
                        glog.is_warn() && glog << "Error: " << human_command_type
                                               << " command returned normally but with "
                                                  "non-zero exit code "
                                               << exit_status << ", output: " << stdout
                                               << std::endl;
                }

                else
                {
                    glog.is_warn() && glog << "Error:  " << human_command_type
                                           << " command exited abnormally. output: " << stdout
                                           << std::endl;
                }
            }
        }
    }

    return success;
}

jaiabot::statechart::postdeployment::DataOffload::~DataOffload()
{
    auto offload_complete_event = dynamic_cast<const EvDataOffloadComplete*>(triggering_event());

    // run post offload only on successful data offload
    if (offload_complete_event)
    {
        if (!run_command(CommandType::POST_OFFLOAD))
        {
            glog.is_warn() && glog << "Post offload command failed" << std::endl;
            this->machine().insert_warning(
                jaiabot::protobuf::WARNING__MISSION__DATA_POST_OFFLOAD_FAILED);
        }
        else
        {
            glog.is_warn() && glog << "Post offload command Succeeded" << std::endl;
            this->machine().erase_warning(
                jaiabot::protobuf::WARNING__MISSION__DATA_POST_OFFLOAD_FAILED);
        }
    }

    glog.is_verbose() && glog << "Start Logging" << std::endl;
    goby::middleware::protobuf::LoggerRequest request;
    request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
    interprocess().publish<goby::middleware::groups::logger_request>(request);
}

// PostDeployment::Idle
jaiabot::statechart::postdeployment::Idle::Idle(typename StateBase::my_context c) : StateBase(c)
{
    if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
    {
        glog.is_verbose() && glog << "Stop Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }
}

jaiabot::statechart::postdeployment::Idle::~Idle()
{
    if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
    {
        glog.is_verbose() && glog << "Start Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }
}

// PostDeployment::Failed
jaiabot::statechart::postdeployment::Failed::Failed(typename StateBase::my_context c) : StateBase(c)
{
    glog.is_verbose() && glog << "Start Logging" << std::endl;
    goby::middleware::protobuf::LoggerRequest request;
    request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
    interprocess().publish<goby::middleware::groups::logger_request>(request);
}

jaiabot::statechart::postdeployment::Failed::~Failed() {}

// PostDeployment::ShuttingDown
jaiabot::statechart::postdeployment::ShuttingDown::ShuttingDown(typename StateBase::my_context c)
    : StateBase(c)
{
    protobuf::Command shutdown;
    shutdown.set_bot_id(cfg().bot_id());
    shutdown.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    shutdown.set_type(protobuf::Command::SHUTDOWN_COMPUTER);
    // publish computer shutdown command to jaiabot_health which is run as root so it
    // can actually carry out the shutdown
    this->interprocess().template publish<jaiabot::groups::powerstate_command>(shutdown);
}

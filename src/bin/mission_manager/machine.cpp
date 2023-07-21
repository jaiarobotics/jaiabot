#include <goby/middleware/log/groups.h>
#include <goby/middleware/protobuf/logger.pb.h>

#include "machine.h"
#include "mission_manager.h"

using goby::glog;
namespace si = boost::units::si;
using boost::units::quantity;

jaiabot::protobuf::IvPBehaviorUpdate
create_transit_update(const jaiabot::protobuf::GeographicCoordinate& location,
                      quantity<si::velocity> speed, const goby::util::UTMGeodesy& geodesy)
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::TransitUpdate& transit = *update.mutable_transit();

    auto xy = geodesy.convert({location.lat_with_units(), location.lon_with_units()});

    transit.set_active(true);
    transit.set_x_with_units(xy.x);
    transit.set_y_with_units(xy.y);
    transit.set_speed_with_units(speed);

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

    if (cfg().data_offload_only_task_packet_file())
    {
        if (this->machine().create_task_packet_file())
        {
            this->machine().set_task_packet_file_name(cfg().interprocess().platform() + "_" +
                                                      this->machine().create_file_date_time() +
                                                      ".taskpacket");

            glog.is_debug1() && glog << "Create a task packet file and only offload that file"
                                     << "to hub (ignore sending goby files)" << std::endl;

            // Extra exclusions for rsync
            this->machine().set_data_offload_exclude(" '*.goby'");
        }
    }
}

jaiabot::statechart::predeployment::StartingUp::~StartingUp() {}

void jaiabot::statechart::predeployment::StartingUp::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= timeout_stop_)
        post_event(EvStartupTimeout());
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
    : AcquiredGPSCommon<Transit, Movement, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT>(c)
{
    boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();
    if (goal)
    {
        auto update = create_transit_update(
            goal->location(), this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().geodesy());
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
    : AcquiredGPSCommon<Transit, Recovery, protobuf::IN_MISSION__UNDERWAY__RECOVERY__TRANSIT>(c)
{
    auto recovery = this->machine().mission_plan().recovery();
    jaiabot::protobuf::IvPBehaviorUpdate update;
    if (recovery.recover_at_final_goal())
    {
        auto final_goal = context<InMission>().final_goal();
        update = create_transit_update(final_goal.location(),
                                       this->machine().mission_plan().speeds().transit_with_units(),
                                       this->machine().geodesy());
    }
    else
    {
        update = create_transit_update(recovery.location(),
                                       this->machine().mission_plan().speeds().transit_with_units(),
                                       this->machine().geodesy());
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
    : AcquiredGPSCommon<StationKeep, Recovery,
                        protobuf::IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP>(c)
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
    if (!has_manual_task_)
    {
        goby::glog.is_debug1() && goby::glog << "Increment Waypoint index" << std::endl;
        // each time we complete a autonomous task - we should increment the goal index
        context<InMission>().increment_goal_index();
    }

    task_packet_.set_end_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());

    if (task_packet_.type() == protobuf::MissionTask::DIVE ||
        task_packet_.type() == protobuf::MissionTask::SURFACE_DRIFT)
    {
        if (cfg().data_offload_only_task_packet_file())
        {
            // Open task packet file
            std::ofstream task_packet_file(
                cfg().log_dir() + "/" + this->machine().task_packet_file_name(), std::ios::app);

            // Convert to json string
            std::string json_string;
            google::protobuf::util::JsonPrintOptions json_options;
            // Set the snake_case option
            json_options.preserve_proto_field_names = true;

            google::protobuf::util::MessageToJsonString(task_packet_, &json_string, json_options);

            // Check if it is a new task packet file
            if (this->machine().create_task_packet_file())
            {
                task_packet_file << json_string;
                this->machine().set_create_task_packet_file(false);
            }
            else
            {
                task_packet_file << "\n" << json_string;
            }

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
            intervehicle().publish<groups::task_packet>(task_packet_);
        }
    }
}

// Task::Dive
jaiabot::statechart::inmission::underway::task::Dive::Dive(typename StateBase::my_context c)
    : StateBase(c)
{
    // This makes sure we capture the pressure before the dive begins
    // Then we can adjust pressure accordingly
    this->machine().set_start_of_dive_pressure(this->machine().current_pressure());

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
}

// Task::Dive::PrePoweredDescent
jaiabot::statechart::inmission::underway::task::dive::PrePoweredDescent::PrePoweredDescent(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();

    // duration granularity is seconds
    int pre_powered_descent_timeout_seconds = cfg().pre_powered_descent_timeout();

    goby::time::SteadyClock::duration pre_powered_descent_timeout_duration =
        std::chrono::seconds(pre_powered_descent_timeout_seconds);

    pre_powered_descent_timeout_ = start_timeout + pre_powered_descent_timeout_duration;

    loop(EvLoop());
}

jaiabot::statechart::inmission::underway::task::dive::PrePoweredDescent::~PrePoweredDescent()
{
    if (machine().gps_tpv().has_location())
    {
        const auto& pos = machine().gps_tpv().location();
        auto& start = *context<Dive>().dive_packet().mutable_start_location();
        start.set_lat_with_units(pos.lat_with_units());
        start.set_lon_with_units(pos.lon_with_units());
    }
}

void jaiabot::statechart::inmission::underway::task::dive::PrePoweredDescent::loop(const EvLoop&)
{
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    if (current_clock >= pre_powered_descent_timeout_)
    {
        glog.is_debug2() && glog << "Pre Powered Descent completed" << std::endl;
        post_event(EvPrePoweredDescentComplete());
    }
    else
    {
        glog.is_debug2() && glog << "Waiting for Pre Powered Descent to be completed" << std::endl;
    }
}

// Task::Dive::PoweredDescent
jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::PoweredDescent(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();
    // duration granularity is seconds
    int detect_bottom_logic_init_timeout_seconds = cfg().detect_bottom_logic_init_timeout();

    // duration granularity is seconds
    int powered_descent_timeout_seconds = cfg().powered_descent_timeout();

    goby::time::SteadyClock::duration detect_bottom_logic_init_duration =
        std::chrono::seconds(detect_bottom_logic_init_timeout_seconds);

    goby::time::SteadyClock::duration powered_descent_timeout_duration =
        std::chrono::seconds(powered_descent_timeout_seconds);

    detect_bottom_logic_init_timeout_ = start_timeout + detect_bottom_logic_init_duration;

    powered_descent_timeout_ = start_timeout + powered_descent_timeout_duration;

    loop(EvLoop());
}

jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::~PoweredDescent()
{
    goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
    goby::time::MicroTime dt(end_time - start_time_ - duration_correction_);
    context<Dive>().add_to_dive_duration(dt);
}

void jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::loop(const EvLoop&)
{
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_DIVE);
    setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    // make sure we have a safety timeout to transition into unpowered ascent
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

void jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth(
    const EvVehicleDepth& ev)
{
    glog.is_debug1() &&
        glog << "Entered "
                "jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth: \n"
             << std::endl;
    dive_pdescent_debug_.set_current_depth(ev.depth.value());
    dive_pdescent_debug_.set_goal_depth(context<Dive>().goal_depth().value());
    dive_pdescent_debug_.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
    dive_pdescent_debug_.set_last_depth(last_depth_.value());
    dive_pdescent_debug_.set_last_depth_change_time(last_depth_change_time_.value());
    dive_pdescent_debug_.set_bottoming_timeout_with_units(cfg().bottoming_timeout_with_units());

    glog.is_debug2() && glog << "Current Depth: " << ev.depth.value()
                             << "\n Goal Depth: " << context<Dive>().goal_depth().value() << "\n"
                             << std::endl;

    glog.is_debug2() &&
        glog << "if (boost::units::abs(ev.depth - context<Dive>().goal_depth()) < "
                "cfg().dive_depth_eps_with_units()): "
             << (boost::units::abs(ev.depth - context<Dive>().goal_depth()) <
                 cfg().dive_depth_eps_with_units())
             << "\n ev.depth: " << ev.depth.value()
             << "\n context<Dive>().goal_depth(): " << context<Dive>().goal_depth().value()
             << "\n cfg().dive_depth_eps: " << cfg().dive_depth_eps() << "\n"
             << std::endl;

    if (boost::units::abs(ev.depth - context<Dive>().goal_depth()) <
        cfg().dive_depth_eps_with_units())
    {
        glog.is_debug2() && glog << "(boost::units::abs(ev.depth - context<Dive>().goal_depth()) < "
                                    "cfg().dive_depth_eps_with_units() == true"
                                 << "\n post_event(EvDepthTargetReached());"
                                 << "\n"
                                 << std::endl;

        // Set depth achieved if we have reached our goal depth
        context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);
        dive_pdescent_debug_.set_depth_reached(true);
        post_event(EvDepthTargetReached());
    }

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
    goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

    dive_pdescent_debug_.set_current_time(now.value());

    glog.is_debug2() &&
        glog << "if ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units()): "
             << ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units())
             << "\n ev.depth: " << ev.depth.value() << "\n last_depth_" << last_depth_.value()
             << "\n cfg().dive_depth_eps: " << cfg().dive_depth_eps() << "\n"
             << std::endl;

    // make sure we have finished the initial startup
    // time to begin detecting bottom
    if (current_clock >= detect_bottom_logic_init_timeout_)
    {
        glog.is_debug2() && glog << "Initial detect bottom timeout completed!" << std::endl;

        // if we've moved eps meters in depth, reset the timer for determining hitting the seafloor
        if ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units())
        {
            glog.is_debug2() &&
                glog << "(ev.depth - last_depth_) > cfg().dive_depth_eps_with_units() == true"
                     << "\n dive_pdescent_debug_.set_depth_changed(true);"
                     << "\n"
                     << std::endl;
            last_depth_change_time_ = now;
            last_depth_ = ev.depth;
            dive_pdescent_debug_.set_depth_changed(true);
        }

        glog.is_debug2() &&
            glog << "if ((now - last_depth_change_time_) > "
                    "static_cast<decltype(now)>(cfg().bottoming_timeout_with_units())): "
                 << ((now - last_depth_change_time_) >
                     static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()))
                 << "\n now: " << now.value()
                 << "\n last_depth_change_time_: " << last_depth_change_time_.value()
                 << "\n static_cast<decltype(now)>(cfg().bottoming_timeout_with_units(): "
                 << static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()).value() << "\n"
                 << std::endl;

        // assume we've hit the bottom if the depth isn't changing for bottoming timeout seconds
        if ((now - last_depth_change_time_) >
            static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()))
        {
            glog.is_debug2() &&
                glog << "(now - last_depth_change_time_) > "
                        "static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()) == true"
                     << "\n post_event(EvDepthTargetReached());"
                     << "\n"
                     << std::endl;
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
            dive_pdescent_debug_.set_depth_change_timeout(true);
        }
    }
    else
    {
        glog.is_debug2() && glog << "Waiting for initial detect bottom timeout to be completed!"
                                 << std::endl;
    }

    interprocess().publish<jaiabot::groups::mission_dive>(dive_pdescent_debug_);
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
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_DIVE);
    setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

    dive_hold_debug_.set_current_time(now.time_since_epoch().count());
    dive_hold_debug_.set_hold_timeout(hold_stop_.time_since_epoch().count());

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
            dive_hold_debug_.set_dive_complete(true);
        }
        else
        {
            glog.is_debug2() && glog << "context<Dive>().dive_complete() == false"
                                     << "\n post_event(EvHoldComplete())" << std::endl;
            post_event(EvHoldComplete());
            dive_hold_debug_.set_hold_complete(true);
        }
    }
    interprocess().publish<jaiabot::groups::mission_dive>(dive_hold_debug_);
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

    glog.is_debug2() &&
        glog << "if (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units()): "
             << (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units())
             << "\n ev.depth: " << ev.depth.value()
             << "\n context<Dive>().dive_packet().depth_achieved_with_units(): "
             << context<Dive>().dive_packet().depth_achieved_with_units().value() << "\n"
             << std::endl;
    if (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units())
    {
        glog.is_debug2() &&
            glog << "ev.depth > context<Dive>().dive_packet().depth_achieved_with_units() == true\n"
                 << std::endl;
        context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);
    }

    depths_.push_back(ev.depth);

    glog.is_debug2() && glog << "Current Depth: " << ev.depth.value() << std::endl;

    dive_hold_debug_.set_current_depth(ev.depth.value());
    interprocess().publish<jaiabot::groups::mission_dive>(dive_hold_debug_);
    glog.is_debug1() &&
        glog << "Exit jaiabot::statechart::inmission::underway::task::dive::Hold::depth: \n"
             << std::endl;
}

// Task::Dive::UnpoweredAscent
jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::UnpoweredAscent(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point timeout_start = goby::time::SteadyClock::now();

    // duration granularity is seconds
    int timeout_seconds = cfg().surfacing_timeout_with_units<goby::time::SITime>().value();
    goby::time::SteadyClock::duration timeout_duration = std::chrono::seconds(timeout_seconds);
    timeout_stop_ = timeout_start + timeout_duration;
}

jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::~UnpoweredAscent()
{
    goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
    quantity<si::time> dt(end_time - start_time_);
    quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
    quantity<si::velocity> vz = dz / dt;
    context<Dive>().dive_packet().set_unpowered_rise_rate_with_units(vz);
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

    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

    dive_uascent_debug_.set_current_time(now.time_since_epoch().count());
    dive_uascent_debug_.set_unpowered_ascent_timeout(timeout_stop_.time_since_epoch().count());

    glog.is_debug2() && glog << "if (now >= timeout_stop_): " << (now >= timeout_stop_)
                             << "\n now: " << now.time_since_epoch().count()
                             << "\n timeout_stop_: " << timeout_stop_.time_since_epoch().count()
                             << "\n"
                             << std::endl;

    if (now >= timeout_stop_)
    {
        glog.is_debug2() && glog << "now >= timeout_stop_ == true"
                                 << "\npost_event(EvSurfacingTimeout());  " << std::endl;
        post_event(EvSurfacingTimeout());
        dive_uascent_debug_.set_unpowered_ascent_timed_out(true);
    }
    interprocess().publish<jaiabot::groups::mission_dive>(dive_uascent_debug_);
    glog.is_debug1() &&
        glog << "Exit jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::loop: "
                "\n"
             << std::endl;
}

void jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth(
    const EvVehicleDepth& ev)
{
    glog.is_debug1() &&
        glog << "Entered "
                "jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth: \n"
             << std::endl;

    glog.is_debug2() && glog << "if (ev.depth < cfg().dive_surface_eps_with_units()): "
                             << (ev.depth < cfg().dive_surface_eps_with_units())
                             << "\n ev.depth: " << ev.depth.value()
                             << "\n cfg().dive_surface_eps()(): " << cfg().dive_surface_eps()
                             << "\n"
                             << std::endl;

    // within surface eps of the surface (or any negative value)
    if (ev.depth < cfg().dive_surface_eps_with_units())
    {
        glog.is_debug2() && glog << "ev.depth < cfg().dive_surface_eps_with_units() == true"
                                 << "\npost_event(EvSurfaced());" << std::endl;
        post_event(EvSurfaced());
        dive_uascent_debug_.set_surfaced(true);
    }

    dive_uascent_debug_.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
    dive_uascent_debug_.set_current_depth(ev.depth.value());
    interprocess().publish<jaiabot::groups::mission_dive>(dive_uascent_debug_);
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
}

// Task::Dive::PoweredAscent
jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::~PoweredAscent()
{
    goby::time::MicroTime end_time{goby::time::SystemClock::now<goby::time::MicroTime>()};
    quantity<si::time> dt(end_time - start_time_);
    quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
    quantity<si::velocity> vz = dz / dt;
    context<Dive>().dive_packet().set_powered_rise_rate_with_units(vz);
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
        glog.is_debug2() && glog << "Powered Ascent: Turn off motor, we have timed out on motor on!"
                                 << std::endl;
        powered_ascent_motor_off_timeout_ = current_clock + powered_ascent_motor_off_duration_;
        in_motor_off_mode_ = true;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    }
    // we have not timedout on motor on
    else if (current_clock < powered_ascent_motor_on_timeout_)
    {
        glog.is_debug2() && glog << "Powered Ascent: Leave motor running, we have not timed out!"
                                 << std::endl;
        setpoint_msg.set_type(protobuf::SETPOINT_POWERED_ASCENT);
    }
    // we have timedout on motor off,
    // turn on motor
    else if (current_clock >= powered_ascent_motor_off_timeout_)
    {
        glog.is_debug2() && glog << "Powered Ascent: Turn on motor, we have timed out on motor off!"
                                 << std::endl;
        powered_ascent_motor_on_timeout_ = current_clock + powered_ascent_motor_on_duration_;
        in_motor_off_mode_ = false;
        setpoint_msg.set_type(protobuf::SETPOINT_POWERED_ASCENT);
    }
    // we have not timedout on motor off
    else if (current_clock < powered_ascent_motor_off_timeout_)
    {
        glog.is_debug2() && glog << "Powered Ascent: Leave motor off, we have not timed out!"
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

    glog.is_debug2() && glog << "if (ev.depth < cfg().dive_surface_eps_with_units()): "
                             << (ev.depth < cfg().dive_surface_eps_with_units())
                             << "\n ev.depth: " << ev.depth.value()
                             << "\n cfg().dive_surface_eps(): " << cfg().dive_surface_eps() << "\n"
                             << std::endl;

    // within surface eps of the surface (or any negative value)
    if (ev.depth < cfg().dive_surface_eps_with_units())
    {
        glog.is_debug2() && glog << "ev.depth < cfg().dive_surface_eps_with_units() == true"
                                 << "\npost_event(EvSurfaced());" << std::endl;
        post_event(EvSurfaced());
        dive_pascent_debug_.set_surfaced(true);
    }

    dive_pascent_debug_.set_depth_eps_with_units(cfg().dive_depth_eps_with_units());
    dive_pascent_debug_.set_current_depth(ev.depth.value());
    interprocess().publish<jaiabot::groups::mission_dive>(dive_pascent_debug_);
    glog.is_debug1() &&
        glog
            << "Exit jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::depth: \n"
            << std::endl;
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
}

jaiabot::statechart::inmission::underway::task::ConstantHeading::~ConstantHeading()
{
    jaiabot::protobuf::IvPBehaviorUpdate constantHeadingUpdate;
    jaiabot::protobuf::IvPBehaviorUpdate constantSpeedUpdate;
    constantHeadingUpdate.mutable_constantheading()->set_active(false);
    constantSpeedUpdate.mutable_constantspeed()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);
}

void jaiabot::statechart::inmission::underway::task::ConstantHeading::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= setpoint_stop_)
        post_event(EvTaskComplete());
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
}

jaiabot::statechart::inmission::underway::task::dive::ReacquireGPS::~ReacquireGPS()
{
    end_time_ = goby::time::SystemClock::now<goby::time::MicroTime>();
    context<Dive>().dive_packet().set_duration_to_acquire_gps_with_units(end_time_ - start_time_);
}

// Task::StationKeep
jaiabot::statechart::inmission::underway::task::StationKeep::StationKeep(
    typename StateBase::my_context c)
    : AcquiredGPSCommon<StationKeep, Task, protobuf::IN_MISSION__UNDERWAY__TASK__STATION_KEEP>(c)
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
    : AcquiredGPSCommon<StationKeep, RemoteControl,
                        protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP>(c)
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
}

// PostDeployment::DataProcessing
jaiabot::statechart::postdeployment::DataProcessing::DataProcessing(
    typename StateBase::my_context c)
    : StateBase(c)
{
    if (cfg().data_offload_only_task_packet_file())
    {
        // Reset if recovered
        // If bot is activated again and more task packets
        // are received, then the bot will create a new file
        // to log them
        this->machine().set_create_task_packet_file(true);
    }

    // currently we do not do any data processing on the bot
    post_event(EvDataProcessingComplete());
}

// PostDeployment::DataOffload
jaiabot::statechart::postdeployment::DataOffload::DataOffload(typename StateBase::my_context c)
    : StateBase(c)
{
    // Inputs to data offload command log dir, hub ip, and extra exclusions for rsync
    this->set_offload_command(cfg().data_offload_command() + " " + cfg().class_b_network() + "." +
                              std::to_string(cfg().fleet_id()) + "." +
                              std::to_string((cfg().hub_start_ip() + this->machine().hub_id())) +
                              this->machine().data_offload_exclude() + " 2>&1");

    auto offload_func = [this]() {
        glog.is_debug1() && glog << "Offloading data with command: [" << this->offload_command()
                                 << "]" << std::endl;

        FILE* pipe = popen(this->offload_command().c_str(), "r");
        if (!pipe)
        {
            glog.is_warn() && glog << "Error opening pipe to data offload command: "
                                   << strerror(errno) << std::endl;
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

                // Check if the line contains progress information
                std::string percent_complete_str = "";
                percent_complete_str.append(buffer.begin(), buffer.begin() + bytes_read);
                size_t pos = percent_complete_str.find("%");
                if (pos != std::string::npos)
                {
                    if (pos >= 3)
                    {
                        glog.is_debug2() && glog << percent_complete_str.substr(pos - 3, 3) << "%"
                                                 << std::endl;

                        uint32_t percent = std::stoi(percent_complete_str.substr(pos - 3, 3));
                        this->set_data_offload_percentage(percent);
                    }
                }
            }

            if (!feof(pipe))
            {
                pclose(pipe);
                glog.is_warn() && glog
                                      << "Error reading output while executing data offload command"
                                      << std::endl;
            }
            else
            {
                int status = pclose(pipe);
                if (status < 0)
                {
                    glog.is_warn() &&
                        glog << "Error executing data offload command: " << strerror(errno)
                             << ", output: " << stdout << std::endl;
                }
                else
                {
                    if (WIFEXITED(status))
                    {
                        int exit_status = WEXITSTATUS(status);
                        if (exit_status == 0)
                            offload_success_ = true;
                        else
                            glog.is_warn() &&
                                glog << "Error: Offload command returned normally but with "
                                        "non-zero exit code "
                                     << exit_status << ", output: " << stdout << std::endl;
                    }

                    else
                    {
                        glog.is_warn() &&
                            glog << "Error: Offload command exited abnormally. output: " << stdout
                                 << std::endl;
                    }
                }
            }
        }
        offload_complete_ = true;
    };

    offload_thread_.reset(new std::thread(offload_func));
}

void jaiabot::statechart::postdeployment::DataOffload::loop(const EvLoop&)
{
    if (offload_complete_)
    {
        offload_thread_->join();

        if (cfg().is_sim())
        {
            offload_success_ = true;
        }

        if (!offload_success_)
            this->machine().insert_warning(
                jaiabot::protobuf::WARNING__MISSION__DATA_OFFLOAD_FAILED);
        else // clear any previous offload failed warning
            this->machine().erase_warning(jaiabot::protobuf::WARNING__MISSION__DATA_OFFLOAD_FAILED);

        post_event(EvDataOffloadComplete());
    }
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

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

// Movement::Transit
jaiabot::statechart::inmission::underway::movement::Transit::Transit(
    typename StateBase::my_context c)
    : StateBase(c)
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
    : StateBase(c)
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
    : StateBase(c)
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

    dive_packet_.set_bot_id(cfg().bot_id());
    dive_packet_.set_start_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    dive_packet_.set_depth_achieved(0);
}

jaiabot::statechart::inmission::underway::task::Dive::~Dive()
{
    // compute dive rate based on dz / (sum of dt while in PoweredDescent)
    quantity<si::time> dt(dive_duration_);
    quantity<si::length> dz(context<Dive>().dive_packet().depth_achieved_with_units());
    quantity<si::velocity> vz = dz / dt;
    dive_packet().set_dive_rate_with_units(vz);

    // ensure we don't exceed the bounds on the DCCL repeated field
    const auto max_measurement_size = dive_packet_.GetDescriptor()
                                          ->FindFieldByName("measurement")
                                          ->options()
                                          .GetExtension(dccl::field)
                                          .max_repeat();
    if (dive_packet_.measurement_size() > max_measurement_size)
    {
        glog.is_warn() && glog << "Number of measurements (" << dive_packet_.measurement_size()
                               << ") exceed DivePacket maximum of " << max_measurement_size
                               << ". Truncating." << std::endl;
        while (dive_packet_.measurement_size() > max_measurement_size)
            dive_packet_.mutable_measurement()->RemoveLast();
    }

    dive_packet_.set_end_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
    intervehicle().publish<groups::dive_packet>(dive_packet_);
}

// Task::Dive::PoweredDescent
jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::PoweredDescent(
    typename StateBase::my_context c)
    : StateBase(c)
{
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
}

void jaiabot::statechart::inmission::underway::task::dive::PoweredDescent::depth(
    const EvVehicleDepth& ev)
{
    if (boost::units::abs(ev.depth - context<Dive>().goal_depth()) <
        cfg().dive_depth_eps_with_units())
        post_event(EvDepthTargetReached());

    auto now = goby::time::SystemClock::now<goby::time::MicroTime>();
    // if we've moved eps meters in depth, reset the timer for determining hitting the seafloor
    if ((ev.depth - last_depth_) > cfg().dive_depth_eps_with_units())
    {
        last_depth_change_time_ = now;
        last_depth_ = ev.depth;
    }

    // assume we've hit the bottom if the depth isn't changing for bottoming timeout seconds
    if ((now - last_depth_change_time_) >
        static_cast<decltype(now)>(cfg().bottoming_timeout_with_units()))
    {
        context<Dive>().set_seafloor_reached(ev.depth);
        // used to correct dive rate calculation
        duration_correction_ = (now - last_depth_change_time_);
        post_event(EvDepthTargetReached());
    }
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
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_DIVE);
    setpoint_msg.set_dive_depth_with_units(context<Dive>().goal_depth());
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

    if (now >= hold_stop_)
    {
        context<Dive>().pop_goal_depth();
        if (context<Dive>().dive_complete())
            post_event(EvDiveComplete());
        else
            post_event(EvHoldComplete());
    }
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
    if (ev.depth > context<Dive>().dive_packet().depth_achieved_with_units())
        context<Dive>().dive_packet().set_depth_achieved_with_units(ev.depth);

    depths_.push_back(ev.depth);
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
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);

    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= timeout_stop_)
    {
        post_event(EvSurfacingTimeout());
    }
}

void jaiabot::statechart::inmission::underway::task::dive::UnpoweredAscent::depth(
    const EvVehicleDepth& ev)
{
    // within depth eps of the surface (or any negative value)
    if (ev.depth < cfg().dive_depth_eps_with_units())
        post_event(EvSurfaced());
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
    setpoint_msg.set_type(protobuf::SETPOINT_POWERED_ASCENT);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
}

void jaiabot::statechart::inmission::underway::task::dive::PoweredAscent::depth(
    const EvVehicleDepth& ev)
{
    if (ev.depth < cfg().dive_depth_eps_with_units())
        post_event(EvSurfaced());
}

// Task::StationKeep
jaiabot::statechart::inmission::underway::task::StationKeep::StationKeep(
    typename StateBase::my_context c)
    : StateBase(c)
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

jaiabot::statechart::inmission::underway::task::StationKeep::~StationKeep()
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    update.mutable_stationkeep()->set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

// Task::SurfaceDrift
jaiabot::statechart::inmission::underway::task::SurfaceDrift::SurfaceDrift(
    typename StateBase::my_context c)
    : StateBase(c)
{
    goby::time::SteadyClock::time_point drift_time_start = goby::time::SteadyClock::now();
    int drift_time_seconds = context<Task>()
                                 .current_task()
                                 ->surface_drift()
                                 .drift_time_with_units<goby::time::SITime>()
                                 .value();
    goby::time::SteadyClock::duration drift_time_duration =
        std::chrono::seconds(drift_time_seconds);
    drift_time_stop_ = drift_time_start + drift_time_duration;
}

void jaiabot::statechart::inmission::underway::task::SurfaceDrift::loop(const EvLoop&)
{
    goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
    if (now >= drift_time_stop_)
        post_event(EvTaskComplete());

    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
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
    : StateBase(c)
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
    protobuf::DesiredSetpoints setpoint_msg;
    setpoint_msg.set_type(protobuf::SETPOINT_STOP);
    interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
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

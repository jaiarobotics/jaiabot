#include "machine.h"
#include "mission_manager.h"

using goby::glog;

jaiabot::protobuf::IvPBehaviorUpdate
create_transit_update(const jaiabot::protobuf::GeographicCoordinate& location,
                      boost::units::quantity<boost::units::si::velocity> speed,
                      const goby::util::UTMGeodesy& geodesy)
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::TransitUpdate& transit = *update.mutable_transit();

    auto xy = geodesy.convert({location.lat_with_units(), location.lon_with_units()});

    transit.set_x_with_units(xy.x);
    transit.set_y_with_units(xy.y);
    transit.set_speed_with_units(speed);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

jaiabot::protobuf::IvPBehaviorUpdate
create_stationkeep_update(const jaiabot::protobuf::GeographicCoordinate& location,
                          boost::units::quantity<boost::units::si::velocity> transit_speed,
                          boost::units::quantity<boost::units::si::velocity> outer_speed,
                          const goby::util::UTMGeodesy& geodesy)
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

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

// Movement::Transit
jaiabot::statechart::underway::movement::Transit::Transit(typename StateBase::my_context c)
    : StateBase(c)
{
    boost::optional<protobuf::MissionPlan::Goal> goal = context<Underway>().current_goal();

    if (goal)
    {
        auto update = create_transit_update(
            goal->location(), this->cfg().transit_speed_with_units(), this->machine().geodesy());
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }
}

// Recovery::Transit
jaiabot::statechart::underway::recovery::Transit::Transit(typename StateBase::my_context c)
    : StateBase(c)
{
    auto recovery = this->machine().mission_plan().recovery();
    jaiabot::protobuf::IvPBehaviorUpdate update;
    if (recovery.recover_at_final_goal())
    {
        auto final_goal = context<Underway>().final_goal();
        update =
            create_transit_update(final_goal.location(), this->cfg().transit_speed_with_units(),
                                  this->machine().geodesy());
    }
    else
    {
        update = create_transit_update(recovery.location(), this->cfg().transit_speed_with_units(),
                                       this->machine().geodesy());
    }
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

// Recovery::StationKeep
jaiabot::statechart::underway::recovery::StationKeep::StationKeep(typename StateBase::my_context c)
    : StateBase(c)
{
    auto recovery = this->machine().mission_plan().recovery();
    jaiabot::protobuf::IvPBehaviorUpdate update;
    if (recovery.recover_at_final_goal())
    {
        auto final_goal = context<Underway>().final_goal();
        update = create_stationkeep_update(
            final_goal.location(), this->cfg().transit_speed_with_units(),
            this->cfg().stationkeep_outer_speed_with_units(), this->machine().geodesy());
    }
    else
    {
        update = create_stationkeep_update(
            recovery.location(), this->cfg().transit_speed_with_units(),
            this->cfg().stationkeep_outer_speed_with_units(), this->machine().geodesy());
    }
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

jaiabot::statechart::underway::recovery::StationKeep::~StationKeep()
{
    jaiabot::protobuf::IvPBehaviorUpdate update;
    jaiabot::protobuf::IvPBehaviorUpdate::StationkeepUpdate& stationkeep =
        *update.mutable_stationkeep();

    stationkeep.set_active(false);
    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

// Boost
#include <boost/units/systems/si/velocity.hpp>
using namespace boost::units;

// Goby
#include <goby/middleware/log/groups.h>
#include <goby/middleware/protobuf/logger.pb.h>
using goby::glog;

// Jaiabot
#include "jaiabot/messages/mission.pb.h"


IvPBehaviorUpdate
create_transit_update(const GeographicCoordinate& location,
                      quantity<si::velocity> speed, const goby::util::UTMGeodesy& geodesy,
                      const int& slip_radius)
{
    IvPBehaviorUpdate update;
    IvPBehaviorUpdate::TransitUpdate& transit = *update.mutable_transit();

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

IvPBehaviorUpdate create_location_stationkeep_update(
    const GeographicCoordinate& location, quantity<si::velocity> transit_speed,
    quantity<si::velocity> outer_speed, const goby::util::UTMGeodesy& geodesy)
{
    IvPBehaviorUpdate update;
    IvPBehaviorUpdate::StationkeepUpdate& stationkeep =
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

IvPBehaviorUpdate
create_center_activate_stationkeep_update(quantity<si::velocity> transit_speed,
                                          quantity<si::velocity> outer_speed)
{
    IvPBehaviorUpdate update;
    IvPBehaviorUpdate::StationkeepUpdate& stationkeep =
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

IvPBehaviorUpdate
create_constant_heading_update(quantity<si::plane_angle> heading)
{
    IvPBehaviorUpdate update;
    IvPBehaviorUpdate::ConstantHeadingUpdate& constantHeading =
        *update.mutable_constantheading();

    constantHeading.set_active(true);
    constantHeading.set_heading_with_units(heading);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}

IvPBehaviorUpdate create_constant_speed_update(quantity<si::velocity> speed)
{
    IvPBehaviorUpdate update;
    IvPBehaviorUpdate::ConstantSpeedUpdate& constantSpeed =
        *update.mutable_constantspeed();

    constantSpeed.set_active(true);
    constantSpeed.set_speed_with_units(speed);

    glog.is_verbose() && glog << group("movement")
                              << "Sending update to pHelmIvP: " << update.ShortDebugString()
                              << std::endl;
    return update;
}


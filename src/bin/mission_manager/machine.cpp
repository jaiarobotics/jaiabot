#include "machine.h"
#include "mission_manager.h"

jaiabot::statechart::underway::movement::Transit::Transit(typename StateBase::my_context c)
    : StateBase(c)
{
    protobuf::MissionPlan::Goal goal = context<Underway>().current_goal();
    protobuf::IvPBehaviorUpdate update;
    protobuf::IvPBehaviorUpdate::TransitUpdate& transit = *update.mutable_transit();

    auto xy = this->machine().geodesy().convert(
        {goal.location().lat_with_units(), goal.location().lon_with_units()});

    transit.set_x_with_units(xy.x);
    transit.set_y_with_units(xy.y);
    transit.set_speed_with_units(this->cfg().transit_speed_with_units());

    this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
}

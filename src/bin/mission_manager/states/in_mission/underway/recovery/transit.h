// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct Transit;
#else
struct Transit
    : IvPSensorPauseCommon<Transit, Recovery, protobuf::IN_MISSION__UNDERWAY__RECOVERY__TRANSIT>
{
    using Base =
        IvPSensorPauseCommon<Transit, Recovery, protobuf::IN_MISSION__UNDERWAY__RECOVERY__TRANSIT>;

    Transit(typename StateBase::my_context c)
    : Base(c)
    {
        auto recovery = this->machine().mission_plan().recovery();
        IvPBehaviorUpdate update;
        int slip_radius = cfg().waypoint_with_no_task_slip_radius();

        if (recovery.recover_at_final_goal())
        {
            auto final_goal = context<InMission>().final_goal();

            if (!final_goal.movewptmode() && !this->machine().gps_tpv().has_location())
            {
                // this goal has no fixed waypoint to fall back on (it's wherever the
                // vehicle currently is) and we don't have a fresh fix to use instead -
                // don't risk transiting toward the stale pre-dive location, just consider
                // the goal already reached
                glog.is_debug1() && glog << "Final goal has moveWptMode == false and no GPS "
                                            "fix available, skipping recovery transit"
                                         << std::endl;
                post_event(EvWaypointReached());
                return;
            }

            protobuf::GeographicCoordinate location = final_goal.location();
            if (!final_goal.movewptmode())
            {
                // final goal represents "wherever the vehicle currently is" rather than a
                // fixed waypoint - use the latest GPS fix instead of the (potentially
                // stale) location captured in the mission plan
                const auto& pos = this->machine().gps_tpv().location();
                location.set_lat_with_units(pos.lat_with_units());
                location.set_lon_with_units(pos.lon_with_units());
            }

            update = create_transit_update(
                location, this->machine().mission_plan().speeds().transit_with_units(),
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

    ~Transit()
    {
        IvPBehaviorUpdate update;
        update.mutable_transit()->set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    using local_reactions =
        boost::mpl::list<boost::statechart::transition<EvWaypointReached, StationKeep>>;
    using reactions =
        typename boost::mpl::copy<local_reactions,
                                  boost::mpl::front_inserter<Base::common_reactions>>::type;
};
#endif

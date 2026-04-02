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
struct StationKeep;
#else
struct StationKeep : IvPSensorPauseCommon<StationKeep, Recovery,
                                          protobuf::IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP>
{
    using Base = IvPSensorPauseCommon<StationKeep, Recovery,
                                      protobuf::IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP>;

    StationKeep(typename StateBase::my_context c) : Base(c)
    {
        auto recovery = this->machine().mission_plan().recovery();
        IvPBehaviorUpdate update;
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

        if (recovery.sleep_once_goal_reached())
            post_event(EvSleep());
    }

    ~StationKeep()
    {
        IvPBehaviorUpdate update;
        IvPBehaviorUpdate::StationkeepUpdate& stationkeep = *update.mutable_stationkeep();

        stationkeep.set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    using local_reactions = boost::mpl::list<boost::statechart::transition<EvStop, Stopped>>;
    using reactions =
        typename boost::mpl::copy<local_reactions,
                                  boost::mpl::front_inserter<Base::common_reactions>>::type;
};
#endif

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

struct Transit
    : IvPSensorPauseCommon<Transit, Movement, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT>
{
    using Base =
        IvPSensorPauseCommon<Transit, Movement, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRANSIT>;

// Movement::Transit
    Transit(
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
            auto update =
                create_transit_update(goal->location(), this->machine().transit_speed_with_units(),
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

    ~Transit()
    {
        IvPBehaviorUpdate update;
        update.mutable_transit()->set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    void waypoint_reached(const EvWaypointReached&)
    {
        goby::glog.is_debug1() && goby::glog << "Waypoint reached" << std::endl;
        post_event(EvPerformTask());
    }

    using local_reactions =
        boost::mpl::list<boost::statechart::in_state_reaction<EvWaypointReached, Transit,
                                                              &Transit::waypoint_reached>>;

    using reactions =
        typename boost::mpl::copy<local_reactions,
                                  boost::mpl::front_inserter<Base::common_reactions>>::type;
};

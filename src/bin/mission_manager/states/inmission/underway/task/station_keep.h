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

struct StationKeep
: IvPSensorPauseCommon<StationKeep, Task, protobuf::IN_MISSION__UNDERWAY__TASK__STATION_KEEP>
{
    using Base =
        IvPSensorPauseCommon<StationKeep, Task, protobuf::IN_MISSION__UNDERWAY__TASK__STATION_KEEP>;

    StationKeep(
    typename StateBase::my_context c)
    : Base(c)
    {
        boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();

        IvPBehaviorUpdate update;

        // if we have a defined location in the goal
        if (goal)
            update = create_location_stationkeep_update(
                goal->location(), this->machine().transit_speed_with_units(),
                this->machine().mission_plan().speeds().stationkeep_outer_with_units(),
                this->machine().geodesy());
        else // just use our current position
            update = create_center_activate_stationkeep_update(
                this->machine().transit_speed_with_units(),
                this->machine().mission_plan().speeds().stationkeep_outer_with_units());

        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);

        goby::time::SteadyClock::time_point setpoint_start = goby::time::SteadyClock::now();
        int setpoint_seconds = goal.get().task().station_keep().station_keep_time();
        goby::time::SteadyClock::duration setpoint_duration = std::chrono::seconds(setpoint_seconds);
        setpoint_stop_ = setpoint_start + setpoint_duration;
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= setpoint_stop_)
            post_event(EvTaskComplete());
    }

    ~StationKeep()
    {
        IvPBehaviorUpdate update;
        update.mutable_stationkeep()->set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }


    using local_reactions = boost::mpl::list<>;
    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, StationKeep, &StationKeep::loop>>;

private:
    goby::time::SteadyClock::time_point setpoint_stop_;
};

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
struct ConstantHeading;
#else
struct ConstantHeading
: boost::statechart::state<ConstantHeading, Task>,
    Notify<ConstantHeading, protobuf::IN_MISSION__UNDERWAY__TASK__CONSTANT_HEADING,
            protobuf::SETPOINT_IVP_HELM>
{
    using StateBase = boost::statechart::state<ConstantHeading, Task>;

    ConstantHeading(
    typename StateBase::my_context c)
    : StateBase(c)
    {
        boost::optional<protobuf::MissionPlan::Goal> goal = context<InMission>().current_goal();

        boost::units::quantity<boost::units::si::plane_angle> heading(
            (goal.get().task().constant_heading().constant_heading() * boost::units::degree::degrees));

        boost::units::quantity<boost::units::si::velocity> speed(
            (goal.get().task().constant_heading().constant_heading_speed() *
            boost::units::si::meters_per_second));

        IvPBehaviorUpdate constantHeadingUpdate;
        IvPBehaviorUpdate constantSpeedUpdate;

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

    ~ConstantHeading()
    {
        IvPBehaviorUpdate constantHeadingUpdate;
        IvPBehaviorUpdate constantSpeedUpdate;
        constantHeadingUpdate.mutable_constantheading()->set_active(false);
        constantSpeedUpdate.mutable_constantspeed()->set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(constantHeadingUpdate);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(constantSpeedUpdate);

        // Turn off pid for constant heading (different than the transit pid)
        context<InMission>().set_use_heading_constant_pid(false);
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= setpoint_stop_)
            post_event(EvTaskComplete());
    }

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, ConstantHeading, &ConstantHeading::loop>>;

private:
    goby::time::SteadyClock::time_point setpoint_stop_;
};
#endif

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
                goal->location(), this->machine().mission_plan().speeds().transit_with_units(),
                this->machine().mission_plan().speeds().stationkeep_outer_with_units(),
                this->machine().geodesy());
        else // just use our current position
            update = create_center_activate_stationkeep_update(
                this->machine().mission_plan().speeds().transit_with_units(),
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

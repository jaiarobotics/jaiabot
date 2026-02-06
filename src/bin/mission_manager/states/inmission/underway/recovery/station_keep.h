struct StationKeep : IvPSensorPauseCommon<StationKeep, Recovery,
                                          protobuf::IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP>
{
    using Base = IvPSensorPauseCommon<StationKeep, Recovery,
                                      protobuf::IN_MISSION__UNDERWAY__RECOVERY__STATION_KEEP>;

    StationKeep(typename StateBase::my_context c)
    : Base(c)
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
    }

    ~StationKeep()
    {
        IvPBehaviorUpdate update;
        IvPBehaviorUpdate::StationkeepUpdate& stationkeep =
            *update.mutable_stationkeep();

        stationkeep.set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    using local_reactions = boost::mpl::list<boost::statechart::transition<EvStop, Stopped>>;
    using reactions =
        typename boost::mpl::copy<local_reactions,
                                  boost::mpl::front_inserter<Base::common_reactions>>::type;
};

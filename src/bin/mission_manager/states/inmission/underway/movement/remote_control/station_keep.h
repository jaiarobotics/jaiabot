struct StationKeep
    : IvPSensorPauseCommon<StationKeep, RemoteControl,
                           protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP>
{
    using Base = IvPSensorPauseCommon<
        StationKeep, RemoteControl,
        protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__STATION_KEEP>;


    StationKeep(typename StateBase::my_context c) : Base(c)
    {
        IvPBehaviorUpdate update = create_center_activate_stationkeep_update(
            this->machine().mission_plan().speeds().transit_with_units(),
            this->machine().mission_plan().speeds().stationkeep_outer_with_units());
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    ~StationKeep()
    {
        IvPBehaviorUpdate update;
        update.mutable_stationkeep()->set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    using local_reactions = boost::mpl::list<>;

    using reactions =
        typename boost::mpl::copy<local_reactions,
                                  boost::mpl::front_inserter<Base::common_reactions>>::type;
};


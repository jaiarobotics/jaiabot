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
            update = create_transit_update(final_goal.location(),
                                        this->machine().mission_plan().speeds().transit_with_units(),
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

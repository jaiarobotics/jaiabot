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
            auto update = create_transit_update(
                goal->location(), this->machine().mission_plan().speeds().transit_with_units(),
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

struct Trail
: IvPSensorPauseCommon<Trail, Movement, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRAIL>
{
    using Base =
        IvPSensorPauseCommon<Trail, Movement, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__TRAIL>;

    Trail(typename StateBase::my_context c)
    : Base(c)
    {
        // next goal (after trailing) is recovery
        context<InMission>().set_goal_index_to_recovery();

        IvPBehaviorUpdate update;
        update.mutable_trail()->set_active(true);
        if (this->machine().mission_plan().has_trail())
            *update.mutable_trail()->mutable_param() = this->machine().mission_plan().trail();

        glog.is_verbose() && glog << group("movement")
                                << "Sending update to pHelmIvP: " << update.ShortDebugString()
                                << std::endl;

        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    ~Trail()
    {
        IvPBehaviorUpdate update;
        update.mutable_trail()->set_active(false);
        this->interprocess().publish<groups::mission_ivp_behavior_update>(update);
    }

    using local_reactions = boost::mpl::list<>;

    using reactions =
        typename boost::mpl::copy<local_reactions,
                                  boost::mpl::front_inserter<Base::common_reactions>>::type;
};

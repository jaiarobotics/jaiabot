struct Ready : boost::statechart::state<Ready, PreDeployment>,
               Notify<Ready, protobuf::PRE_DEPLOYMENT__READY>
{
    using StateBase = boost::statechart::state<Ready, PreDeployment>;
    Ready(typename StateBase::my_context c) : StateBase(c)
    {
        auto mission_feasible_event = dynamic_cast<const EvMissionFeasible*>(triggering_event());
        auto mission_feasible_override_event =
            dynamic_cast<const EvRCOverrideFailed*>(triggering_event());

        if (mission_feasible_event)
        {
            goby::glog.is_debug1() && goby::glog << "Ready: mission_feasible_event." << std::endl;
            const auto plan = mission_feasible_event->plan;
            // reset the datum on the initial mission
            this->machine().set_mission_plan(plan, true);
            if (plan.start() == protobuf::MissionPlan::START_IMMEDIATELY)
                post_event(EvDeployed());
        }
        else if (mission_feasible_override_event)
        {
            goby::glog.is_debug1() && goby::glog << "Ready: mission_feasible_override_event."
                                                 << std::endl;

            const auto plan = mission_feasible_override_event->plan;
            // reset the datum on the initial mission
            this->machine().set_mission_plan(plan, true);
            if (plan.start() == protobuf::MissionPlan::START_IMMEDIATELY)
                post_event(EvDeployed());
        }
    }
    ~Ready() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvDeployed, InMission>>;
};


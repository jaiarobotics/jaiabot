struct WaitForMissionPlan
    : boost::statechart::state<WaitForMissionPlan, PreDeployment>,
      Notify<WaitForMissionPlan, protobuf::PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN>
{
    using StateBase = boost::statechart::state<WaitForMissionPlan, PreDeployment>;
    WaitForMissionPlan(typename StateBase::my_context c) : StateBase(c) {}
    ~WaitForMissionPlan() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvMissionFeasible, Ready>,
                         // maybe change to in_state_reaction?
                         boost::statechart::transition<EvMissionInfeasible, WaitForMissionPlan>>;
};


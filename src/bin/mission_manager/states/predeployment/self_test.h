struct SelfTest : boost::statechart::state<SelfTest, PreDeployment>,
                  Notify<SelfTest, protobuf::PRE_DEPLOYMENT__SELF_TEST>
{
    using StateBase = boost::statechart::state<SelfTest, PreDeployment>;
    SelfTest(typename StateBase::my_context c) : StateBase(c)
    {
        // TODO add timeout on SelfTest and then post Fails if timeout passes
    }
    ~SelfTest() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvSelfTestFails, Failed>,
                         boost::statechart::transition<EvSelfTestSuccessful, WaitForMissionPlan>>;
};


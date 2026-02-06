struct Recovered : boost::statechart::state<Recovered, PostDeployment>,
                Notify<Recovered, protobuf::POST_DEPLOYMENT__RECOVERED>
{
    using StateBase = boost::statechart::state<Recovered, PostDeployment>;
    Recovered(typename StateBase::my_context c) : StateBase(c)
    {
        // automatically go into data offload
        post_event(EvBeginDataOffload());
    }
    ~Recovered() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvBeginDataOffload, DataOffload>>;
};


struct ShuttingDown : boost::statechart::state<ShuttingDown, PostDeployment>,
                      Notify<ShuttingDown, protobuf::POST_DEPLOYMENT__SHUTTING_DOWN>
{
    using StateBase = boost::statechart::state<ShuttingDown, PostDeployment>;

    ShuttingDown(typename StateBase::my_context c) 
    : StateBase(c)
    {
        protobuf::Command shutdown;
        shutdown.set_bot_id(cfg().bot_id());
        shutdown.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        shutdown.set_type(protobuf::Command::SHUTDOWN_COMPUTER);
        // publish computer shutdown command to jaiabot_health which is run as root so it
        // can actually carry out the shutdown
        this->interprocess().template publish<jaiabot::groups::powerstate_command>(shutdown);
    }

    ~ShuttingDown() {}
};

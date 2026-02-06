struct Stopped : boost::statechart::state<Stopped, Recovery>,
                 Notify<Stopped, protobuf::IN_MISSION__UNDERWAY__RECOVERY__STOPPED>
{
    using StateBase = boost::statechart::state<Stopped, Recovery>;

    Stopped(typename StateBase::my_context c) : StateBase(c)
    {
        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
        this->machine().erase_warning(WARNING__MISSION__DATA__GPS_FIX_DEGRADED);
    }

    ~Stopped() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, postdeployment::ShuttingDown>>;
};

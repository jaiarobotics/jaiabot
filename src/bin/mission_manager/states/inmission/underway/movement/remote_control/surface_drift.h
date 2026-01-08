struct SurfaceDrift
    : boost::statechart::state<SurfaceDrift, RemoteControl>,
      Notify<SurfaceDrift, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SURFACE_DRIFT,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<SurfaceDrift, RemoteControl>;
    SurfaceDrift(typename StateBase::my_context c) : StateBase(c)
    {
        // Stop the craft
        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }
    ~SurfaceDrift() {}

    void loop(const EvLoop&)
    {
    }

    using reactions = boost::mpl::list<
        boost::statechart::in_state_reaction<EvLoop, SurfaceDrift, &SurfaceDrift::loop>>;
};


struct Setpoint
    : boost::statechart::state<Setpoint, RemoteControl>,
      Notify<Setpoint, protobuf::IN_MISSION__UNDERWAY__MOVEMENT__REMOTE_CONTROL__SETPOINT,
             protobuf::SETPOINT_REMOTE_CONTROL>
{
    using StateBase = boost::statechart::state<Setpoint, RemoteControl>;

    Setpoint(typename StateBase::my_context c) : StateBase(c)
    {
        auto rc_setpoint_event = dynamic_cast<const EvRCSetpoint*>(triggering_event());
        if (rc_setpoint_event)
        {
            rc_setpoint_ = rc_setpoint_event->rc_setpoint;
        }

        goby::time::SteadyClock::time_point setpoint_start = goby::time::SteadyClock::now();
        int setpoint_seconds = rc_setpoint_.duration_with_units<goby::time::SITime>().value();
        goby::time::SteadyClock::duration setpoint_duration = std::chrono::seconds(setpoint_seconds);
        setpoint_stop_ = setpoint_start + setpoint_duration;
    }

    ~Setpoint() {}

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= setpoint_stop_)
            post_event(EvRCSetpointComplete());

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_REMOTE_CONTROL);
        *setpoint_msg.mutable_remote_control() = rc_setpoint_;
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvRCSetpointComplete, RemoteControlEndSelection>,
        boost::statechart::in_state_reaction<EvLoop, Setpoint, &Setpoint::loop>>;

  private:
    goby::time::SteadyClock::time_point setpoint_stop_;
    protobuf::RemoteControl rc_setpoint_;
};

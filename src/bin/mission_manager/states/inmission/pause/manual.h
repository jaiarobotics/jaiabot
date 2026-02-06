struct Manual : boost::statechart::state<Manual, Pause>,
                Notify<Manual, protobuf::IN_MISSION__PAUSE__MANUAL, protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<Manual, Pause>;
    Manual(typename StateBase::my_context c) : StateBase(c) {}
    ~Manual() {}

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvResume,
                                      boost::statechart::deep_history<underway::Abort // default
                                                                      >>>;
};

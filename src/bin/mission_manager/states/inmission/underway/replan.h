struct Replan : boost::statechart::state<Replan, Underway>,
                Notify<Replan, protobuf::IN_MISSION__UNDERWAY__REPLAN,
                       protobuf::SETPOINT_IVP_HELM // stationkeep
                       >
{
    using StateBase = boost::statechart::state<Replan, Underway>;
    Replan(typename StateBase::my_context c) : StateBase(c) {}
    ~Replan() {}

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvMissionInfeasible, Replan>, // maybe in_state_reaction
        boost::statechart::transition<EvMissionFeasible, Movement>>;
};

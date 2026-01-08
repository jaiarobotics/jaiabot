struct Abort : boost::statechart::state<Abort, Underway>,
               Notify<Abort, protobuf::IN_MISSION__UNDERWAY__ABORT>
{
    using StateBase = boost::statechart::state<Abort, Underway>;
    Abort(typename StateBase::my_context c) : StateBase(c)
    {
        // once we go into abort, the mission is considered complete
        context<InMission>().set_mission_complete();
    }
    ~Abort() {}
};


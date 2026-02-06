// dummy state that should immediately transit to the correct Movement child state based on the current mission movement value
struct MovementSelection : boost::statechart::state<MovementSelection, Movement>,
                           AppMethodsAccess<MovementSelection>
{
    struct EvMovementSelect : boost::statechart::event<EvMovementSelect>
    {
    };

    using StateBase = boost::statechart::state<MovementSelection, Movement>;
    MovementSelection(typename StateBase::my_context c) : StateBase(c)
    {
        post_event(EvMovementSelect());
    }
    ~MovementSelection() {}

    boost::statechart::result react(const EvMovementSelect&)
    {
        switch (this->machine().mission_plan().movement())
        {
            case protobuf::MissionPlan::TRANSIT: return transit<Transit>();
            case protobuf::MissionPlan::REMOTE_CONTROL: return transit<RemoteControl>();
            case protobuf::MissionPlan::TRAIL: return transit<Trail>();
        }

        // should never reach here but if does, abort the mission
        return transit<underway::Abort>();
    }

    using reactions = boost::statechart::custom_reaction<EvMovementSelect>;
};

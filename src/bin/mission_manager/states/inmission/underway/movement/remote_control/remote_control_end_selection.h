// dummy state that should immediately transit to the correct RemoteControl child state based on the configured rc_setpoint_end value
struct RemoteControlEndSelection
    : boost::statechart::state<RemoteControlEndSelection, RemoteControl>,
      AppMethodsAccess<RemoteControlEndSelection>
{
    struct EvRCEndSelect : boost::statechart::event<EvRCEndSelect>
    {
    };

    using StateBase = boost::statechart::state<RemoteControlEndSelection, RemoteControl>;
    RemoteControlEndSelection(typename StateBase::my_context c) : StateBase(c)
    {
        post_event(EvRCEndSelect());
    }
    ~RemoteControlEndSelection() {}

    boost::statechart::result react(const EvRCEndSelect&)
    {
        switch (this->cfg().rc_setpoint_end())
        {
            case config::MissionManager::RC_SETPOINT_ENDS_IN_STATIONKEEP: return transit<StationKeep>();
            case config::MissionManager::RC_SETPOINT_ENDS_IN_SURFACE_DRIFT:
                return transit<SurfaceDrift>();
        }

        // should never reach here but if does, abort the mission
        return transit<underway::Abort>();
    }

    using reactions = boost::statechart::custom_reaction<EvRCEndSelect>;
};


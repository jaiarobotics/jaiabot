struct ResolveNoForwardProgress
    : boost::statechart::state<ResolveNoForwardProgress, Pause>,
      Notify<ResolveNoForwardProgress, protobuf::IN_MISSION__PAUSE__RESOLVE_NO_FORWARD_PROGRESS,
             protobuf::SETPOINT_STOP>
{
    using StateBase = boost::statechart::state<ResolveNoForwardProgress, Pause>;

    ResolveNoForwardProgress(typename StateBase::my_context c)
        : StateBase(c)
    {
        goby::time::SteadyClock::time_point resolve_start = goby::time::SteadyClock::now();
        auto resume_duration = goby::time::convert_duration<goby::time::SteadyClock::duration>(
            cfg().resolve_no_forward_progress().resume_timeout_with_units());
        resume_timeout_ = resolve_start + resume_duration;
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();

        // for now, simply wait a period of time and then resume
        if (now >= resume_timeout_)
        {
            post_event(EvForwardProgressResolved());
        }
    }

    ~ResolveNoForwardProgress()
    {
        this->machine().erase_warning(WARNING__VEHICLE__NO_FORWARD_PROGRESS);
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvForwardProgressResolved,
                                      boost::statechart::deep_history<underway::Abort // default
                                                                      >>,
        boost::statechart::in_state_reaction<EvLoop, ResolveNoForwardProgress,
                                             &ResolveNoForwardProgress::loop>>;

  private:
    goby::time::SteadyClock::time_point resume_timeout_;
};

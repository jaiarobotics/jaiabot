struct StartingUp : boost::statechart::state<StartingUp, PreDeployment>,
                    Notify<StartingUp, protobuf::PRE_DEPLOYMENT__STARTING_UP>
{
    using StateBase = boost::statechart::state<StartingUp, PreDeployment>;
    StartingUp(typename StateBase::my_context c)
    : StateBase(c)
    {
        goby::time::SteadyClock::time_point timeout_start = goby::time::SteadyClock::now();

        int timeout_seconds = cfg().startup_timeout_with_units<goby::time::SITime>().value();
        goby::time::SteadyClock::duration timeout_duration = std::chrono::seconds(timeout_seconds);
        timeout_stop_ = timeout_start + timeout_duration;

        // update which files are excluded from data offload
        switch (cfg().data_offload_exclude())
        {
            case config::MissionManager::GOBY:
                this->machine().set_data_offload_exclude(" '*.goby'");
                break;
            case config::MissionManager::TASKPACKET:
                this->machine().set_data_offload_exclude(" '*.taskpacket'");
                break;
            case config::MissionManager::NONE: this->machine().set_data_offload_exclude(""); break;
            default: this->machine().set_data_offload_exclude(""); break;
        }
    }

    ~StartingUp() {}

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point now = goby::time::SteadyClock::now();
        if (now >= timeout_stop_)
            post_event(EvStartupTimeout());
    }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvStarted, Idle>,
        boost::statechart::transition<EvStartupTimeout, Failed>,
        boost::statechart::in_state_reaction<EvLoop, StartingUp, &StartingUp::loop>>;

  private:
    goby::time::SteadyClock::time_point timeout_stop_;
};


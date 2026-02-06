struct Failed : boost::statechart::state<Failed, PreDeployment>,
                Notify<Failed, protobuf::PRE_DEPLOYMENT__FAILED>
{
    using StateBase = boost::statechart::state<Failed, PreDeployment>;

    // PreDeployment::Failed
    Failed(typename StateBase::my_context c) : StateBase(c)
    {
        goby::time::SteadyClock::time_point start_timeout = goby::time::SteadyClock::now();

        // duration granularity is seconds
        int failed_startup_log_seconds = cfg().failed_startup_log_timeout();

        goby::time::SteadyClock::duration failed_startup_log_duration =
            std::chrono::seconds(failed_startup_log_seconds);

        failed_startup_log_timeout_ = start_timeout + failed_startup_log_duration;

        loop(EvLoop());
    }

    ~Failed()
    {
        glog.is_verbose() && glog << "Start Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }

    void loop(const EvLoop&)
    {
        goby::time::SteadyClock::time_point current_clock = goby::time::SteadyClock::now();

        // make sure we have a safety timeout to transition into unpowered ascent
        if (current_clock >= failed_startup_log_timeout_)
        {
            glog.is_verbose() && glog << "Stop Logging" << std::endl;
            goby::middleware::protobuf::LoggerRequest request;
            request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
            interprocess().publish<goby::middleware::groups::logger_request>(request);
        }
    }

    void isFeasibleMissionRC(const EvMissionFeasible& ev)
    {
        if (ev.plan.movement() == protobuf::MissionPlan_MovementType_REMOTE_CONTROL)
        {
            goby::glog.is_debug1() && goby::glog << "Mission Plan is rc, override failed state."
                                                 << std::endl;

            post_event(EvRCOverrideFailed(ev.plan));
        }
    }

    // allow Activate from Failed in case an error resolves itself
    // while the vehicle is powered on (e.g. GPS fix after several minutes).
    // If Activate is sent and the vehicle still has an error,
    // SelfTest will simply fail again and we'll end up back here in Failed (as desired)
    // Check the mission to see if is a rc mission. If it is then we should override.
    using reactions =
        boost::mpl::list<boost::statechart::transition<EvActivate, SelfTest>,
                         boost::statechart::transition<EvRCOverrideFailed, Ready>,
                         boost::statechart::in_state_reaction<EvLoop, Failed, &Failed::loop>,
                         boost::statechart::in_state_reaction<EvMissionFeasible, Failed,
                                                              &Failed::isFeasibleMissionRC>>;

  private:
    // determines when to stop logging
    goby::time::SteadyClock::time_point failed_startup_log_timeout_;
};


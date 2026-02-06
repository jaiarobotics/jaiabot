struct Idle : boost::statechart::state<Idle, PostDeployment>,
            Notify<Idle, protobuf::POST_DEPLOYMENT__IDLE>
{
    using StateBase = boost::statechart::state<Idle, PostDeployment>;
    
    Idle(typename StateBase::my_context c): StateBase(c) 
    {
        if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
        {
            glog.is_verbose() && glog << "Stop Logging" << std::endl;
            goby::middleware::protobuf::LoggerRequest request;
            request.set_requested_state(goby::middleware::protobuf::LoggerRequest::STOP_LOGGING);
            interprocess().publish<goby::middleware::groups::logger_request>(request);
        }
    }

    ~Idle()
    {
        if (!app().is_test_mode(config::MissionManager::ENGINEERING_TEST__ALWAYS_LOG_EVEN_WHEN_IDLE))
        {
            glog.is_verbose() && glog << "Start Logging" << std::endl;
            goby::middleware::protobuf::LoggerRequest request;
            request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
            interprocess().publish<goby::middleware::groups::logger_request>(request);
        }
    }

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, ShuttingDown>,
                        boost::statechart::transition<EvActivate, predeployment::SelfTest>>;
};


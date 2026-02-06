struct Failed : boost::statechart::state<Failed, PostDeployment>,
                Notify<Failed, protobuf::POST_DEPLOYMENT__FAILED>
{
    using StateBase = boost::statechart::state<Failed, PostDeployment>;

    Failed(typename StateBase::my_context c) : StateBase(c) 
    {
        glog.is_verbose() && glog << "Start Logging" << std::endl;
        goby::middleware::protobuf::LoggerRequest request;
        request.set_requested_state(goby::middleware::protobuf::LoggerRequest::START_LOGGING);
        interprocess().publish<goby::middleware::groups::logger_request>(request);
    }

    ~Failed() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, ShuttingDown>,
                         boost::statechart::transition<EvRetryDataOffload, DataOffload>>;
};


// This file contains the definition of the PreDeployment state and its substates.

struct PreDeployment
: boost::statechart::state<PreDeployment,              // (CRTP)
                            MissionManagerStateMachine, // Parent state (or machine)
                            predeployment::StartingUp   // Initial child substate
                            >
{
    using StateBase = boost::statechart::state<PreDeployment, MissionManagerStateMachine,
                                               predeployment::StartingUp>;

    // entry action
    PreDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PreDeployment() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvShutdown, postdeployment::ShuttingDown>,
                         boost::statechart::transition<EvRecovered, postdeployment::Recovered>>;
};

namespace predeployment
{

    #include "predeployment/starting_up.h"
    #include "predeployment/idle.h"
    #include "predeployment/self_test.h"
    #include "predeployment/failed.h"
    #include "predeployment/wait_for_mission_plan.h"
    #include "predeployment/ready.h"

} // namespace predeployment

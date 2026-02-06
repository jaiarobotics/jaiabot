// This file contains the definition of the PostDeployment state and its substates.

struct PostDeployment : boost::statechart::state<PostDeployment, MissionManagerStateMachine,
                                                 postdeployment::Recovered>
{
    using StateBase = boost::statechart::state<PostDeployment, MissionManagerStateMachine,
                                               postdeployment::Recovered>;

    // entry action
    PostDeployment(typename StateBase::my_context c) : StateBase(c) {}
    // exit action
    ~PostDeployment() {}
};

namespace postdeployment
{

    #include "postdeployment/idle.h"
    #include "postdeployment/failed.h"
    #include "postdeployment/shutting_down.h"
    #include "postdeployment/recovered.h"
    #include "postdeployment/data_offload.h"

} // namespace postdeployment

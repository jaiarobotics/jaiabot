struct RemoteControl
    : boost::statechart::state<RemoteControl, Movement, remotecontrol::RemoteControlEndSelection>
{
    using StateBase =
        boost::statechart::state<RemoteControl, Movement, remotecontrol::RemoteControlEndSelection>;
    RemoteControl(typename StateBase::my_context c) : StateBase(c) {}
    ~RemoteControl() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvResumeMovement, Movement>>;
};

namespace remotecontrol
{

    #include "remote_control/remote_control_end_selection.h"
    #include "remote_control/station_keep.h"
    #include "remote_control/surface_drift.h"
    #include "remote_control/setpoint.h"

}

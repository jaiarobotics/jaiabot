struct Pause : boost::statechart::state<Pause, InMission, pause::Manual>, AppMethodsAccess<Pause>
{
    using StateBase = boost::statechart::state<Pause, InMission, pause::Manual>;

    Pause(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "Pause" << std::endl;

        protobuf::DesiredSetpoints setpoint_msg;
        setpoint_msg.set_type(protobuf::SETPOINT_STOP);
        interprocess().publish<jaiabot::groups::desired_setpoints>(setpoint_msg);
    }
    ~Pause() { goby::glog.is_debug1() && goby::glog << "~Pause" << std::endl; }
};

namespace pause {

    #include "pause/reacquire_gps.h"
    #include "pause/imu_restart.h"
    #include "pause/manual.h"
    #include "pause/resolve_no_forward_progress.h"

}

struct Underway : boost::statechart::state<Underway, InMission, underway::Movement,
                                           boost::statechart::has_deep_history>,
                  AppMethodsAccess<Underway>
{
    using StateBase = boost::statechart::state<Underway, InMission, underway::Movement,
                                               boost::statechart::has_deep_history>;

    Underway(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "Underway" << std::endl;
    }
    ~Underway() { goby::glog.is_debug1() && goby::glog << "~Underway" << std::endl; }

    using reactions = boost::mpl::list<
        boost::statechart::transition<EvReturnToHome, underway::Recovery>,
        boost::statechart::transition<EvRCSetpoint, underway::movement::remotecontrol::Setpoint>,
        boost::statechart::transition<EvPause, pause::Manual>,
        boost::statechart::transition<EvNoForwardProgress, pause::ResolveNoForwardProgress>>;
};

namespace underway {

    #include "underway/abort.h"
    #include "underway/movement.h"
    #include "underway/recovery.h"
    #include "underway/task.h"
    #include "underway/replan.h"

} // namespace jaiabot::statechart::inmission::underway

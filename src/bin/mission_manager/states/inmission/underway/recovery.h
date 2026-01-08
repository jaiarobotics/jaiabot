struct Recovery : boost::statechart::state<Recovery, Underway, recovery::Transit>
{
    using StateBase = boost::statechart::state<Recovery, Underway, recovery::Transit>;

    Recovery(typename StateBase::my_context c) : StateBase(c)
    {
        // once we go into recovery (for any reason), the mission is considered complete
        context<InMission>().set_mission_complete();
    }
    ~Recovery() {}
};

namespace recovery
{

    #include "recovery/stopped.h"
    #include "recovery/transit.h"
    #include "recovery/station_keep.h"

} // namespace recovery

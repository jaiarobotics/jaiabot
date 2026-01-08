struct Movement : boost::statechart::state<Movement, Underway, movement::MovementSelection,
                                           boost::statechart::has_deep_history>,
                  AppMethodsAccess<Movement>
{
    using StateBase = boost::statechart::state<Movement, Underway, movement::MovementSelection,
                                               boost::statechart::has_deep_history>;

    Movement(typename StateBase::my_context c) : StateBase(c)
    {
        // replan case - update mission from event
        auto mission_feasible_event = dynamic_cast<const EvMissionFeasible*>(triggering_event());
        if (mission_feasible_event)
        {
            this->machine().set_mission_plan(
                mission_feasible_event->plan,
                false); // do not reset the datum on Replanned missions to avoid a race condition with IvP
        }
    }
    ~Movement() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvPerformTask, Task>>;
};

#include "ivp_sensor_pause_common.h"

namespace movement {

    #include "movement/transit.h"
    #include "movement/trail.h"
    #include "movement/movement_selection.h"
    #include "movement/remote_control.h"

}

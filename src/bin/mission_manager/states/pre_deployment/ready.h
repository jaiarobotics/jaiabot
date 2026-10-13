// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
//   Ed Sanville <edsanville@gmail.com>
//
//
// This file is part of the JaiaBot Project Binaries
// ("The Jaia Binaries").
//
// The Jaia Binaries are free software: you can redistribute them and/or modify
// them under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// The Jaia Binaries are distributed in the hope that they will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with the Jaia Binaries.  If not, see <http://www.gnu.org/licenses/>.

#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct Ready;
#else
struct Ready : boost::statechart::state<Ready, PreDeployment>,
               Notify<Ready, protobuf::PRE_DEPLOYMENT__READY>
{
    using StateBase = boost::statechart::state<Ready, PreDeployment>;
    Ready(typename StateBase::my_context c) : StateBase(c)
    {
        auto mission_feasible_event = dynamic_cast<const EvMissionFeasible*>(triggering_event());
        auto mission_feasible_override_event =
            dynamic_cast<const EvRCOverrideFailed*>(triggering_event());

        if (mission_feasible_event)
        {
            goby::glog.is_debug1() && goby::glog << "Ready: mission_feasible_event." << std::endl;
            const auto plan = mission_feasible_event->plan;
            // reset the datum on the initial mission
            this->machine().set_mission_plan(plan, true);
            if (plan.start() == protobuf::MissionPlan::START_IMMEDIATELY)
                post_event(EvDeployed());
        }
        else if (mission_feasible_override_event)
        {
            goby::glog.is_debug1() && goby::glog << "Ready: mission_feasible_override_event."
                                                 << std::endl;

            const auto plan = mission_feasible_override_event->plan;
            // reset the datum on the initial mission
            this->machine().set_mission_plan(plan, true);
            if (plan.start() == protobuf::MissionPlan::START_IMMEDIATELY)
                post_event(EvDeployed());
        }
    }
    ~Ready() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvDeployed, InMission>>;
};
#endif

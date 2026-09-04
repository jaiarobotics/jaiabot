// Copyright 2026:
//   JaiaRobotics LLC
// File authors:
//   Toby Schneider <toby@gobysoft.org>
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

#ifdef JAIABOT_STORM_MANAGER_FWD_DECL
struct Wrapup;
#else
struct Wrapup : boost::statechart::state<Wrapup, SelfTest>,
                Notify<Wrapup, protobuf::SELF_TEST__WRAPUP>
{
    using StateBase = boost::statechart::state<Wrapup, SelfTest>;

    Wrapup(typename StateBase::my_context c) : StateBase(c)
    {
        // currently this state is a no-op, but exists to make a single clean final substate of SelfTest
        post_event(EvSelfTestComplete());

        // inform jaiabot_mission_manager of the result of this delegated state; only
        // reached via the intended completion path, not on machine teardown/shutdown
        protobuf::MissionStateDelegateResponse resp;
        resp.set_state(protobuf::PRE_DEPLOYMENT__SELF_TEST);
        // STORM state machine self test can have warnings
        // but we always want to continue the mission no matter what,
        // which means we always consider the self test successful.
        resp.set_event(protobuf::MissionStateDelegateResponse::EV_SELF_TEST_SUCCESSFUL);
        interprocess().publish<::jaiabot::groups::state_delegate_response>(resp);
    }
    ~Wrapup() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvSelfTestComplete, MissionPlanning>>;
};
#endif

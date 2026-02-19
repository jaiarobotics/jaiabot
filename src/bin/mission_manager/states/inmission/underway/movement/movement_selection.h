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

// dummy state that should immediately transit to the correct Movement child state based on the current mission movement value
#ifdef JAIABOT_MISSION_MANAGER_FWD_DECL
struct MovementSelection;
#else
struct MovementSelection : boost::statechart::state<MovementSelection, Movement>,
                           AppMethodsAccess<MovementSelection>
{
    struct EvMovementSelect : boost::statechart::event<EvMovementSelect>
    {
    };

    using StateBase = boost::statechart::state<MovementSelection, Movement>;
    MovementSelection(typename StateBase::my_context c) : StateBase(c)
    {
        post_event(EvMovementSelect());
    }
    ~MovementSelection() {}

    boost::statechart::result react(const EvMovementSelect&)
    {
        switch (this->machine().mission_plan().movement())
        {
            case protobuf::MissionPlan::TRANSIT: return transit<Transit>();
            case protobuf::MissionPlan::REMOTE_CONTROL: return transit<RemoteControl>();
            case protobuf::MissionPlan::TRAIL: return transit<Trail>();
        }

        // should never reach here but if does, abort the mission
        return transit<underway::Abort>();
    }

    using reactions = boost::statechart::custom_reaction<EvMovementSelect>;
};
#endif

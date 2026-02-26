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
struct Activating;
#else
struct Activating : boost::statechart::state<Activating, StormManagerStateMachine>,
                    Notify<Activating, protobuf::ACTIVATING>
{
    using StateBase = boost::statechart::state<Activating, StormManagerStateMachine>;

    Activating(typename StateBase::my_context c) : StateBase(c)
    {
        protobuf::Command command;
        command.set_bot_id(this->cfg().bot_id());
        command.set_time_with_units(goby::time::SystemClock::now<goby::time::MicroTime>());
        command.set_type(protobuf::Command::ACTIVATE);
        goby::glog.is_verbose() && goby::glog << group("statechart")
                                              << "Sending command: " << command.ShortDebugString()
                                              << std::endl;
        this->interprocess().template publish<jaiabot::groups::self_command>(command);
    }
    ~Activating() {}

    using reactions = boost::mpl::list<boost::statechart::transition<EvBeginSelfTest, SelfTest>>;
};
#endif

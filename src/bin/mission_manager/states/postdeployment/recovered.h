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
struct Recovered;
#else
struct Recovered : boost::statechart::state<Recovered, PostDeployment>,
                Notify<Recovered, protobuf::POST_DEPLOYMENT__RECOVERED>
{
    using StateBase = boost::statechart::state<Recovered, PostDeployment>;
    Recovered(typename StateBase::my_context c) : StateBase(c)
    {
        // automatically go into data offload
        post_event(EvBeginDataOffload());
    }
    ~Recovered() {}

    using reactions =
        boost::mpl::list<boost::statechart::transition<EvBeginDataOffload, DataOffload>>;
};
#endif

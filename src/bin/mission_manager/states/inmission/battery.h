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

struct Battery : boost::statechart::state<Battery, InMission, battery::Low>, AppMethodsAccess<Battery>
{
    using StateBase = boost::statechart::state<Battery, InMission, battery::Low>;

    Battery(typename StateBase::my_context c) : StateBase(c)
    {
        goby::glog.is_debug1() && goby::glog << "Battery" << std::endl;
    }
    ~Battery() { goby::glog.is_debug1() && goby::glog << "~Battery" << std::endl; }
};

namespace battery {
#include "battery/station_keep.h"
#include "battery/stop_and_broadcast.h"
}

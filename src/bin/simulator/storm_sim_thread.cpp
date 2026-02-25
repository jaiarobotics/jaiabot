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

#include <boost/units/io.hpp>

#include <goby/middleware/gpsd/groups.h>
#include <goby/middleware/protobuf/gpsd.pb.h>
#include <goby/middleware/protobuf/io.pb.h>
#include <goby/util/linebasedcomms/gps_sentence.h>
#include <goby/util/sci.h>
#include <goby/util/seawater.h>

#include "jaiabot/groups.h"
#include "jaiabot/messages/simulator.pb.h"
#include "jaiabot/messages/udp_gateway.pb.h"

#include "storm_sim_thread.h"

using goby::glog;

namespace degree = boost::units::degree;
namespace si = boost::units::si;

jaiabot::apps::StormSimThread::StormSimThread(const jaiabot::config::StormSimThread& cfg)
    : SimulatorThread<jaiabot::config::StormSimThread>(cfg, "storm_simulator",
                                                       0 * boost::units::si::hertz)
{
    glog.add_group("storm", goby::util::Colors::magenta);

}

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

#ifndef JAIABOT_STORM_MANAGER_EVENTS_H
#define JAIABOT_STORM_MANAGER_EVENTS_H

// Boost
#include <boost/optional.hpp>

// Goby
#include <boost/statechart/event.hpp>
#include <goby/middleware/group.h>

// Jaiabot
#include "jaiabot/messages/jaia_dccl.pb.h"
#include "jaiabot/messages/mission.pb.h"
#include "jaiabot/units/conductivity.h"

namespace jaiabot
{

namespace apps
{
class StormManager;
}

namespace statechart
{
struct StormManagerStateMachine;

// events
#define STATECHART_EVENT(EVENT)                    \
    struct EVENT : boost::statechart::event<EVENT> \
    {                                              \
    };

// events
STATECHART_EVENT(EvStarted)
STATECHART_EVENT(EvBeginSelfTest)
STATECHART_EVENT(EvWaterDetected)
STATECHART_EVENT(EvLaunchTubeStuck)
STATECHART_EVENT(EvLaunchTubeCleared)
STATECHART_EVENT(EvLaunchTubeRecoveryComplete)
STATECHART_EVENT(EvParachuteReleased)
STATECHART_EVENT(EvParachuteStillAttached)
STATECHART_EVENT(EvParachuteAttachmentRecoveryComplete)
STATECHART_EVENT(EvAirDescentDataTimeout)
STATECHART_EVENT(EvAirDescentDataTransmitted)
STATECHART_EVENT(EvSelfTestComplete)
STATECHART_EVENT(EvMissionManagerReadyForMission)
STATECHART_EVENT(EvRemoteMissionTimeout)
STATECHART_EVENT(EvRemoteMissionReceived)
STATECHART_EVENT(EvMissionRunning)
STATECHART_EVENT(EvSleepInitiated)
STATECHART_EVENT(EvDataOffloadComplete)
STATECHART_EVENT(EvDataOffloadTimeout)
STATECHART_EVENT(EvSleepReady)

struct EvConductivity : boost::statechart::event<EvConductivity>
{
    EvConductivity(boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit> mean,
                   boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit> median,
                   boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit> stddev)
        : mean(mean), median(median), stddev(stddev)
    {
    }
    boost::units::quantity<jaiabot::units::microsiemens_per_cm_unit> mean, median, stddev;
};

struct EvPressure : boost::statechart::event<EvPressure>
{
    EvPressure(boost::units::quantity<boost::units::si::pressure> mean,
               boost::units::quantity<boost::units::si::pressure> median,
               boost::units::quantity<boost::units::si::pressure> stddev)
        : mean(mean), median(median), stddev(stddev)
    {
    }
    boost::units::quantity<boost::units::si::pressure> mean, median, stddev;
};

struct EvGPSAltitude : boost::statechart::event<EvGPSAltitude>
{
    EvGPSAltitude(boost::units::quantity<boost::units::si::length> mean,
                  boost::units::quantity<boost::units::si::length> median,
                  boost::units::quantity<boost::units::si::length> stddev)
        : mean(mean), median(median), stddev(stddev)
    {
    }
    boost::units::quantity<boost::units::si::length> mean, median, stddev;
};
STATECHART_EVENT(EvLoop)

struct EvMCUResponse : boost::statechart::event<EvMCUResponse>
{
    EvMCUResponse(const jaiabot::protobuf::StormMCUResponse& resp) : resp(resp) {}
    jaiabot::protobuf::StormMCUResponse resp;
};

#undef STATECHART_EVENT

} // namespace statechart
} // namespace jaiabot

#endif // JAIABOT_STORM_MANAGER_EVENTS_H

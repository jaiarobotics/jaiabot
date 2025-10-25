#ifndef JAIABOT_SRC_BIN_MISSION_MANAGER_EVENTS_H
#define JAIABOT_SRC_BIN_MISSION_MANAGER_EVENTS_H

#include <boost/statechart/event.hpp>
#include <boost/optional.hpp>
#include "jaiabot/messages/jaia_dccl.pb.h"

using namespace jaiabot::protobuf;

namespace jaiabot {
namespace statechart {

// events
#define STATECHART_EVENT(EVENT)                    \
    struct EVENT : boost::statechart::event<EVENT> \
    {                                              \
    };

// events
STATECHART_EVENT(EvStarted)
STATECHART_EVENT(EvStartupTimeout)
STATECHART_EVENT(EvSelfTestSuccessful)
STATECHART_EVENT(EvSelfTestFails)
struct EvMissionFeasible : boost::statechart::event<EvMissionFeasible>
{
    EvMissionFeasible(const MissionPlan& p) : plan(p) {}
    MissionPlan plan;
};
struct EvRCOverrideFailed : boost::statechart::event<EvRCOverrideFailed>
{
    EvRCOverrideFailed(const MissionPlan& p) : plan(p) {}
    MissionPlan plan;
};

STATECHART_EVENT(EvMissionInfeasible)
STATECHART_EVENT(EvDeployed)
STATECHART_EVENT(EvWaypointReached)

struct EvBotStatusReceived : boost::statechart::event<EvBotStatusReceived>
{
    BotStatus status;
};


struct EvPerformTask : boost::statechart::event<EvPerformTask>
{
    EvPerformTask() : has_task(false) {}
    EvPerformTask(const MissionTask& t) : task(t), has_task(true) {}
    bool has_task;
    MissionTask task;
}; // namespace statechart

STATECHART_EVENT(EvTaskComplete)
STATECHART_EVENT(EvNewMission)
STATECHART_EVENT(EvReturnToHome)
STATECHART_EVENT(EvStop)
STATECHART_EVENT(EvAbort)
STATECHART_EVENT(EvRecovered)
STATECHART_EVENT(EvBeginDataOffload)
STATECHART_EVENT(EvDataOffloadComplete)
STATECHART_EVENT(EvDataOffloadFailed)
STATECHART_EVENT(EvRetryDataOffload)
STATECHART_EVENT(EvShutdown)
STATECHART_EVENT(EvActivate)
STATECHART_EVENT(EvDivePrepComplete)
STATECHART_EVENT(EvDepthTargetReached)
STATECHART_EVENT(EvDiveComplete)
STATECHART_EVENT(EvPowerDescentSafety)
STATECHART_EVENT(EvHoldComplete)
STATECHART_EVENT(EvDiveRising)
STATECHART_EVENT(EvBotNotVertical)
STATECHART_EVENT(EvSurfacingTimeout)
STATECHART_EVENT(EvSurfaced)
STATECHART_EVENT(EvGPSFix)
STATECHART_EVENT(EvGPSNoFix)
STATECHART_EVENT(EvIMURestart)
STATECHART_EVENT(EvIMURestartCompleted)
STATECHART_EVENT(EvBottomDepthAbort)

STATECHART_EVENT(EvLoop)
struct EvVehicleDepth : boost::statechart::event<EvVehicleDepth>
{
    EvVehicleDepth(boost::units::quantity<boost::units::si::length> d) : depth(d) {}
    boost::units::quantity<boost::units::si::length> depth;
};

struct EvMeasurement : boost::statechart::event<EvMeasurement>
{
    boost::optional<
        boost::units::quantity<boost::units::absolute<boost::units::celsius::temperature>>>
        temperature;
    boost::optional<double> salinity;
};

struct EvVehicleGPS : boost::statechart::event<EvVehicleGPS>
{
    double hdop;
    double pdop;
};

struct EvVehiclePitch : boost::statechart::event<EvVehiclePitch>
{
    boost::units::quantity<boost::units::degree::plane_angle> pitch;
};

STATECHART_EVENT(EvResumeMovement)
struct EvRCSetpoint : boost::statechart::event<EvRCSetpoint>
{
    EvRCSetpoint(const RemoteControl& setpoint) : rc_setpoint(setpoint) {}
    RemoteControl rc_setpoint;
};
STATECHART_EVENT(EvRCSetpointComplete)

STATECHART_EVENT(EvPause)
STATECHART_EVENT(EvResume)
STATECHART_EVENT(EvNoForwardProgress)
STATECHART_EVENT(EvForwardProgressResolved)

#undef STATECHART_EVENT

}
}

#endif // JAIABOT_SRC_BIN_MISSION_MANAGER_EVENTS_H
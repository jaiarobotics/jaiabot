// This file contains forward declarations of all state structs
// to allow their use in other headers without circular dependencies.

#pragma once

namespace jaiabot
{
    namespace statechart
    {
        struct PreDeployment;
        namespace predeployment
        {
            struct StartingUp;
            struct Idle;
            struct SelfTest;
            struct Failed;
            struct WaitForMissionPlan;
            struct Ready;
        } // namespace predeployment

        struct InMission;
        namespace inmission
        {
            struct Pause;
            namespace pause
            {
                struct IMURestart;
                struct ReacquireGPS;
                struct Manual;
                struct ResolveNoForwardProgress;
            } // namespace pause
            struct Underway;
            namespace underway
            {
                struct Replan;
                struct Movement;
                namespace movement
                {
                    // dummy state whose role is to dynmically transit to the correct substate
                    // based on the current mission
                    struct MovementSelection;
                    struct Transit;
                    struct RemoteControl;
                    struct Trail;
                    namespace remotecontrol
                    {
                        struct RemoteControlEndSelection;
                        struct StationKeep;
                        struct SurfaceDrift;
                        struct Setpoint;
                    } // namespace remotecontrol

                } // namespace movement

                struct Task;
                namespace task
                {
                    struct TaskSelection;
                    struct StationKeep;
                    struct SurfaceDrift;
                    struct ConstantHeading;
                    struct Dive;
                    namespace dive
                    {
                        struct DivePrep;
                        struct PoweredDescent;
                        struct Hold;
                        struct UnpoweredAscent;
                        struct PoweredAscent;
                        struct ReacquireGPS;
                        struct SurfaceDrift;
                        struct ConstantHeading;
                    } // namespace dive
                } // namespace task

                struct Recovery;
                namespace recovery
                {
                    struct Transit;
                    struct StationKeep;
                    struct Stopped;
                } // namespace recovery
                struct Abort;

            } // namespace underway
        } // namespace inmission

        struct PostDeployment;
        namespace postdeployment
        {
            struct Recovered;
            struct DataOffload;
            struct Idle;
            struct Failed;
            struct ShuttingDown;
        } // namespace postdeployment
    } // namespace statechart
} // namespace jaiabot


# Mission Management

The `jaiabot_mission_manager` maintains a state machine that oversees the overall mission progression from the viewpoint of the Bot.

## State machine

The JaiaBot maintains a hierarchical state machine (HSM), also referred to as a statechart, that keeps track of the vehicle's mission state from PreDeployment, through the in-water "Underway" operations, and finalizing with PostDeployment:

![](../figures/mission-states.png)

The goal is to keep the state machine as simple as possible while still supported all the desired [Use Cases](https://jaia-innovation.atlassian.net/wiki/spaces/PD/pages/389775371/Use+Cases).

### States

- PreDeployment: To be performed before the vehicle is in the water. (Use Cases: "Pre Mission", "Mission Planning", and "System Readiness")
	+ Off: Vehicle is powered off (initial state). This is a somewhat meaningless state in practice but is included for the sake of completeness.
	+ SelfTest: Vehicle checks system statuses and functionality.
	+ Failed: Vehicle has a fault that does not allow it to perform any mission.
	+ WaitForMissionPlan: Vehicle waits for a mission plan from the operator
	+ Ready: Vehicle is ready for deployment.
- Underway: To be performed while the vehicle is in the water. (Use Cases: "Mission", "Recovery")
	+ Movement: Vehicle is moving to the next Task.
		* Transit: Vehicle is transiting to the next waypoint autonomously using the pHelmIvP Waypoint behavior.
		* RemoteControl: Vehicle is accepting RC commands from the UI. When RC commands aren't being received (for any reason), the vehicle is controlled by an underlying pHelmIvP StationKeep behavior that activates on the current vehicle location.
		* ...: Can be expanded in the future to allow other types of Movement states as needed
	+ Task: Vehicle is performing a sampling, station keeping, or other discrete task.
		* StationKeep: Vehicle is actively maintaining a position on the surface.
		* SurfaceDrift: Vehicle is drifting (propulsor off).
		* Dive: Vehicle performs a dive maneuver. 
			- PoweredDescent: Vehicle is diving by powered reverse thrust.
			- Hold: Vehicle is maintaining a specific depth.
			- UnpoweredAscent: Vehicle thruster is off, waiting for vehicle to ascend.
			- PoweredAscent: Vehicle is performing a powered ascent to the surface.
		* ...: Can be expanded in the future for other types of Tasks.
	+ Recovery: Vehicle is returning to a safe location for recovery.
		* Transit: Vehicle is transiting to the recovery location.
		* StationKeep: Vehicle is actively maintaining the recovery location position.
		* Stopped: Control surfaces are stopped for a safe recovery.
	+ Replan: Vehicle has received a new mission and is assessing feasibility.
- PostDeployment: To be performed after the vehicle is in the water. (Use Cases: "Post Mission")
	+ Recovered: Vehicle has been recovered.
	+ DataProcessing: Vehicle is doing automatic post mission conversions (e.g. .goby to HDF5, etc.)
	+ DataOffload: Vehicle is uploading data to a pre-configured storage location.
	+ Idle: Vehicle is awaiting a command to reset for a new mission or shut down.
	+ ShuttingDown: Vehicle is cleanly powering down.

### Events

Events are what drives the changes in states. Some events are triggered by the operator, some by the vehicle autonomy, and some by changes in the environment (or in some cases a single event could be triggered by multiple means). 

- EvTurnOn: Vehicle is powered on. This state is automatically entered by `jaiabot_mission_manager` as if it is running, by definition the vehicle has been powered on.
- EvSelfTestSuccessful: The vehicle self test has completed successfully and no critical failures have been found. This is triggered by a yet-to-be-determined health monitoring application.
- EvSelfTestFails: The vehicle self test fails and the vehicle is unable to perform a mission. This is triggered by a yet-to-be-determined health monitoring application.
- EvMissionFeasible: Triggered by `jaiabot_mission_manager` if the received mission should be feasible within the various constraints (power, etc.). Will be triggered by the `jaiabot_mission_manager` upon receipt of a mission plan from the operator when in a state that can receive mission plans.
- EvMissionInfeasible: Triggered by `jaiabot_mission_manager` if the received mission is not feasible within the various constraints (power, etc.). Will be triggered by the `jaiabot_mission_manager` upon receipt of a mission plan from the operator.
- EvDeployed: Triggered when the vehicle enters the water, via a yet-to-be-determined mechanism.
- EvPerformTask: Triggered in a variety of ways depending on the mission (movement) type:
	- Transit: Triggered when the vehicle reaches the next waypoint. This is triggered via the pHelmIvP waypoint behavior publication.
	- RemoteControl: Triggered via the operator UI new task.
- EvTaskComplete: Triggered when the task has been completed. This can be triggered in a variety of ways, depending on the task:
	+ StationKeep: Not triggered. Rather, EvNewMission is triggered when the operator sends a new mission.
	+ Dive: Triggered when the dive is completed and the vehicle is back on the surface.
	+ SurfaceDrift: Triggered when the drift timer expires. (Or EvNewMission is triggered which starts the new mission).
- EvNewMission: Triggered when the operator sends a new mission and the bot receives it.
- EvReturnToHome: Triggered by the Movement::Transit state when the mission has completed all the preprogrammed waypoints, or via a command from the operator.
- EvRecoveryPointReached: Triggered by the pHelmIvP behavior once the recovery point has been reached.
- EvStopped: Triggered by a command from the operator or by the Abort state.
- EvAbort: Abort triggered by yet-to-be-determined health monitoring process.
- EvRecovered: Triggered when the vehicle detects it is out of the water.
- EvBeginDataProcessing: Triggered by the operator? or automatically upon recovery?
- EvDataProcessingComplete: Triggered by the DataProcessing state when the data have all been processed.
- EvDataOffloadComplete: Triggered by the DataOffload state when the data have all been offloaded.
- EvShutdown: Triggered by the operator.
- EvRedeploy: Triggered by the operator to reset the vehicle back into the PreDeployment state.
- EvDepthTargetReached: Triggered when the Dive behavior reaches a target depth.
- EvHoldComplete: Triggered when the depth target hold timeout expires.
- EvSurfacingTimeout: Triggered when the vehicle has not surfaced after a set amount of time.

## Supporting Use Cases

### Common

Nominal progression:

- PreDeployment::Off (-> vehicle powers on)
- PreDeployment::SelfTest (-> self test completes OK)
- PreDeployment::WaitForMissionPlan (-> operator sends mission plan)
- PreDeployment::Ready (-> operator deploys vehicle into water)
- Underway::*
- Underway::Recovery::Stopped (-> operator picks up vehicle)
- PostDeployment::Recovered (-> data processing begins)
- PostDeployment::DataProcessing (-> data processing completes)
- PostDeployment::DataOffload (-> data upload completes)
- PostDeployment::Idle (-> operator sends shutdown command)
- PostDeployment::ShuttingDown (-> vehicle powers off and we're done)

### Mission Types

- Waypoint Mission: 
	- Set of waypoints loaded into the pHelmIvP waypoint behavior and managed by toggling between Underway::Movement::Transit and Underway::Task::* until the waypoints are completed.
	- Upon completion of waypoints, EvReturnToHome is automatically triggered and the Recovery sequence begins.  
- Optimized Survey Mission	
	+ Topside software generates set of waypoints from the operation region and number of vehicles so this is identical to the Waypoint mission as far as each vehicle is concerned.
- Retasking Use case
	+ This is handled by EvNewMission, which triggers the vehicle to Replan the mission and either begin execution (Movement) or Recovery if the plan is infeasible (e.g. battery too low). Since EvNewMission is accepted at any point within Underway, the operator could send a feasible (e.g. shorter) mission plan even after the vehicle has begun Recovery due to an infeasible new mission.
- Single Vehicle Remote Control Use Case
	+ This is handled using the Movement::RemoteControl state, toggling to the Task::* states via commands from the operator. When the operator isn't providing RC commands, the RemoteControl state will use setpoints from the pHelmIvP stationkeep behavior (until RC commands are received again).
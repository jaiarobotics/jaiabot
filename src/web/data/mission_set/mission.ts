import { GeographicCoordinate } from "../../shared/proto/jaiabot/messages/geographic_coordinate";
import {
    BottomDepthSafetyParams,
    MissionPlan,
    MissionPlan_Goal,
    MissionPlan_MissionStart,
    MissionPlan_MovementType,
    Speeds,
} from "../../shared/proto/jaiabot/messages/mission";
import Waypoint from "../waypoints/waypoint";
import Task from "../tasks/task";
import { GhostParameters } from "../../types/jaia-system-types";
import { UNASSIGNED_ID } from "../../utils/constants";

export default class Mission {
    private missionID: number;
    private waypoints: Waypoint[];
    private speeds: Speeds;
    private repeats: number;
    private bottomDepthSafetyParams: BottomDepthSafetyParams;
    private ghostParameters: GhostParameters;

    constructor() {
        // missionID assigned by missionSet singleton
        // speeds set by missionSet singleton
        this.waypoints = [];
        this.repeats = 1;
        this.ghostParameters = { hasStarted: false, botID: UNASSIGNED_ID, repeats: 1 };
    }

    getMissionID() {
        return this.missionID;
    }

    // Set automatically when a Mission is added to the Missions singleton
    setMissionID(missionID: number) {
        this.missionID = missionID;
    }

    getWaypoints() {
        return this.waypoints;
    }

    setWaypoints(waypoints: Waypoint[]) {
        this.waypoints = waypoints;
    }

    getSpeeds() {
        return this.speeds;
    }

    setSpeeds(speeds: Speeds) {
        this.speeds = { ...speeds };
    }

    getRepeats() {
        return this.repeats;
    }

    setRepeats(repeats: number) {
        this.repeats = repeats;
    }

    getBottomDepthSafetyParams() {
        return this.bottomDepthSafetyParams;
    }

    setBottomDepthSafetyParams(bottomDepthSafetyParams: BottomDepthSafetyParams) {
        this.bottomDepthSafetyParams = bottomDepthSafetyParams;
    }

    getGhostParameters() {
        return this.ghostParameters;
    }

    setGhostParameters(ghostParameters: GhostParameters) {
        this.ghostParameters = ghostParameters;
    }

    resetGhostParameters() {
        this.ghostParameters = { hasStarted: false, botID: UNASSIGNED_ID, repeats: 1 };
    }

    getWaypoint(waypointNum: number) {
        if (waypointNum > 0 && waypointNum <= this.waypoints.length) {
            return this.waypoints[waypointNum - 1];
        }
        return undefined;
    }

    addWaypoint(location: GeographicCoordinate) {
        const waypoint = new Waypoint();
        waypoint.setLocation(location);
        this.waypoints.push(waypoint);
    }

    addWaypoints(waypoints: Waypoint[]) {
        this.waypoints.push(...waypoints);
    }

    deleteWaypoint(waypointNum: number) {
        // Remove last waypoint in constant time
        if (waypointNum === this.waypoints.length) {
            this.waypoints.pop();
        }
        // Remove other waypoints in linear time
        else {
            this.setWaypoints(
                this.waypoints.filter((waypoint, index) => {
                    if (index + 1 !== waypointNum) {
                        return waypoint;
                    }
                }),
            );
        }
    }

    moveWaypoint(waypointNum: number, location: GeographicCoordinate) {
        const index = waypointNum - 1;
        if (index >= 0 && index < this.waypoints.length) {
            const waypoint = this.waypoints[index];
            waypoint.setLocation(location);
        }
    }

    packageMissionForHub(missionSetName: string) {
        const missionPlan: MissionPlan = {
            start: MissionPlan_MissionStart.START_IMMEDIATELY,
            movement: MissionPlan_MovementType.TRANSIT,
            goal: this.packageWaypointsForHub(),
            recovery: {
                recover_at_final_goal: true,
            },
            speeds: this.speeds,
            repeats: this.repeats,
            mission_name: missionSetName,
        };

        if (this.bottomDepthSafetyParams) {
            missionPlan.bottom_depth_safety_params = this.bottomDepthSafetyParams;
        }

        return missionPlan;
    }

    packageWaypointsForHub() {
        const goals: MissionPlan_Goal[] = [];

        for (const waypoint of this.waypoints) {
            goals.push(waypoint.packageWaypointForHub());
        }

        return goals;
    }

    /**
     * Creates a mission object from serialized mission data
     *
     * @param {string} serializedMission Serialized Mission data to transform to Mission object
     * @returns {Mission} mission Resulting Mission object
     */
    static fromJSON(serializedMission: string) {
        const mission = Object.assign(new Mission(), serializedMission);
        mission.waypoints = mission.waypoints.map((serializedWaypoint: any) => {
            const waypoint = Object.assign(new Waypoint(), serializedWaypoint);
            if (serializedWaypoint.task) {
                waypoint.setTask(Object.assign(new Task(), serializedWaypoint.task));
            }
            waypoint.setLocation(serializedWaypoint.location);
            return waypoint;
        });
        return mission;
    }
}

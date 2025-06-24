import {
    GeographicCoordinate,
    Goal,
    MissionPlan,
    MissionStart,
    MovementType,
    Speeds,
} from "../../types/protobuf-types";
import Waypoint from "../waypoints/waypoint";

export default class Mission {
    private missionID: number;
    private waypoints: Waypoint[];
    private speeds: Speeds;
    private repeats: number;
    private saveName: string;

    constructor() {
        // missionID assigned by missions singleton
        this.waypoints = [];
        this.repeats = 1;
    }

    getMissionID() {
        return this.missionID;
    }

    // Set automatically when a Mission is added to the Missions singleton
    setMissionID(missionID: number) {
        this.missionID = missionID;
    }

    setSaveName(saveName: string) {
        this.saveName = saveName;
    }

    getSaveName() {
        return this.saveName;
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

    packageMissionForHub() {
        const missionPlan: MissionPlan = {
            start: MissionStart.START_IMMEDIATELY,
            movement: MovementType.TRANSIT,
            goal: this.packageWaypointsForHub(),
            recovery: {
                recover_at_final_goal: true,
            },
            speeds: this.speeds,
            repeats: this.repeats,
        };

        return missionPlan;
    }

    packageWaypointsForHub() {
        const goals: Goal[] = [];

        for (const waypoint of this.waypoints) {
            goals.push(waypoint.packageWaypointForHub());
        }

        return goals;
    }
}

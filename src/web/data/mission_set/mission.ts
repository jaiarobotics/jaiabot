import {
    BottomDepthSafetyParams,
    GeographicCoordinate,
    Goal,
    MissionPlan,
    MissionStart,
    MovementType,
    Segment,
} from "../../types/protobuf-types";
import Waypoint from "../waypoints/waypoint";
import Task from "../tasks/task";
import { GhostParameters } from "../../types/jaia-system-types";
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../utils/constants";

export default class Mission {
    private missionID: number;
    private waypoints: Waypoint[];
    private stationkeepSpeed: number;
    private repeats: number;
    private segments: Segment[];
    private ghostParameters: GhostParameters;

    constructor() {
        // missionID assigned by missionSet singleton
        // speeds set by missionSet singleton
        this.waypoints = [];
        this.stationkeepSpeed = DEFAULT_SPEED;
        this.repeats = 1;
        this.segments = [{ start_goal_index: 0 }];
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

    getTransitSpeed(segmentIndex: number = 0): number {
        return this.segments[segmentIndex]?.speed ?? DEFAULT_SPEED;
    }

    setTransitSpeed(speed: number) {
        for (const segment of this.segments) {
            segment.speed = speed;
        }
    }

    getStationkeepSpeed(): number {
        return this.stationkeepSpeed;
    }

    setStationkeepSpeed(speed: number) {
        this.stationkeepSpeed = speed;
    }

    getRepeats() {
        return this.repeats;
    }

    setRepeats(repeats: number) {
        this.repeats = repeats;
    }

    getBottomDepthSafetyParams(segmentIndex: number = 0) {
        return this.segments[segmentIndex]?.bottom_depth_safety_params;
    }

    setBottomDepthSafetyParams(
        bottomDepthSafetyParams: BottomDepthSafetyParams,
        segmentIndex: number = 0,
    ) {
        this.segments[segmentIndex].bottom_depth_safety_params = bottomDepthSafetyParams;
    }

    getSegments() {
        return this.segments;
    }

    setSegments(segments: Segment[]) {
        this.segments = segments;
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
        const index = waypointNum - 1;
        if (index < 0 || index >= this.waypoints.length) return;
        this.waypoints.splice(index, 1);
        this.reindexSegmentsAfterRemoval(index);
    }

    /**
     * Keeps segment boundaries on the waypoints they were created for after a goal is removed.
     * Indices past the removed goal shift back by one. Segments and lane starts left covering
     * no goals are dropped, so waypoints appended later join the last remaining segment.
     * At least one segment is always kept.
     * @param {number} removedIndex 0-based goal index that was removed
     */
    private reindexSegmentsAfterRemoval(removedIndex: number) {
        const shift = (goalIndex: number) => (goalIndex > removedIndex ? goalIndex - 1 : goalIndex);
        const goalCount = this.waypoints.length;

        const shifted = this.segments.map((segment) => ({
            ...segment,
            start_goal_index: shift(segment.start_goal_index),
            ...(segment.lane_start_goal_indices && {
                lane_start_goal_indices: segment.lane_start_goal_indices.map(shift),
            }),
        }));
        const segmentEnd = (segments: Segment[], i: number) =>
            i + 1 < segments.length ? segments[i + 1].start_goal_index : goalCount;

        let remaining = shifted.filter(
            (segment, i) => segment.start_goal_index < segmentEnd(shifted, i),
        );
        if (remaining.length === 0) {
            remaining = [{ ...shifted[0], start_goal_index: 0 }];
        }

        // A lane start at or before its segment's start is never a resume target on the bot
        this.segments = remaining.map((segment, i) => {
            if (!segment.lane_start_goal_indices) return segment;
            const end = segmentEnd(remaining, i);
            return {
                ...segment,
                lane_start_goal_indices: segment.lane_start_goal_indices.filter(
                    (laneStart) => laneStart > segment.start_goal_index && laneStart < end,
                ),
            };
        });
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
            start: MissionStart.START_IMMEDIATELY,
            movement: MovementType.TRANSIT,
            goal: this.packageWaypointsForHub(),
            recovery: {
                recover_at_final_goal: true,
            },
            speeds: {
                transit: this.getTransitSpeed(),
                stationkeep_outer: this.getStationkeepSpeed(),
            },
            repeats: this.repeats,
            mission_name: missionSetName,
            segments: this.segments,
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
        mission.segments = (mission.segments ?? []).map((seg: any) => ({
            ...seg,
            ...(seg.lane_start_goal_indices && {
                lane_start_goal_indices: [...seg.lane_start_goal_indices],
            }),
            ...(seg.bottom_depth_safety_params && {
                bottom_depth_safety_params: { ...seg.bottom_depth_safety_params },
            }),
        }));
        // Migrate legacy mission-level speeds into the new fields
        const legacySpeeds = (serializedMission as any).speeds;
        if (legacySpeeds !== undefined) {
            if (legacySpeeds.transit !== undefined && mission.segments.length > 0) {
                if (mission.segments[0].speed === undefined) {
                    mission.segments[0] = { ...mission.segments[0], speed: legacySpeeds.transit };
                }
            }
            if (legacySpeeds.stationkeep_outer !== undefined) {
                mission.setStationkeepSpeed(legacySpeeds.stationkeep_outer);
            }
        }
        return mission;
    }
}

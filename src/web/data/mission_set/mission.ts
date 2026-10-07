import {
    BottomDepthSafetyParams,
    GeographicCoordinate,
    Goal,
    MissionPlan,
    MissionStart,
    MovementType,
    Segment,
} from "../../types/protobuf-types";
import cloneDeep from "lodash/cloneDeep";
import Waypoint, { MissionWaypoint } from "../waypoints/waypoint";
import Task from "../tasks/task";
import { GhostParameters } from "../../types/jaia-system-types";
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../utils/constants";

export default class Mission {
    private missionID: number;
    private waypoints: MissionWaypoint[];
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

    /** The waypoints that are shown and sent: every stored waypoint that is not suppressed. */
    getWaypoints(): readonly Waypoint[] {
        return this.visibleWaypoints();
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

    getWaypoint(waypointNum: number): Waypoint | undefined {
        return this.visibleWaypoints()[waypointNum - 1];
    }

    /**
     * Visible number of a waypoint this mission holds, or undefined if it is suppressed or
     * not in this mission. Waypoint objects persist through an operation, so a caller can
     * renumber a selection after the operation renumbers the mission.
     *
     * @param {Waypoint} waypoint Waypoint previously returned by this mission
     * @returns {number | undefined} 1-based visible waypoint number
     */
    getWaypointNum(waypoint: Waypoint): number | undefined {
        const index = this.visibleWaypoints().indexOf(waypoint as MissionWaypoint);
        return index >= 0 ? index + 1 : undefined;
    }

    addWaypoint(location: GeographicCoordinate) {
        this.waypoints.push(new MissionWaypoint(location));
    }

    /**
     * Appends copies of the given waypoints' locations and tasks. Flags are not copied:
     * only Mission's own operations make detour or suppressed waypoints.
     *
     * @param {readonly Waypoint[]} waypoints Waypoints to copy onto the end of the mission
     * @returns {void}
     */
    addWaypoints(waypoints: readonly Waypoint[]) {
        for (const source of waypoints) {
            const waypoint = new MissionWaypoint(cloneDeep(source.getLocation()));
            waypoint.setTask(cloneDeep(source.getTask()));
            this.waypoints.push(waypoint);
        }
    }

    /**
     * Appends copies of another mission's stored waypoints, flags included, so a combined
     * mission keeps each source's detour and suppressed waypoints.
     *
     * @param {Mission} source Mission whose stored waypoints are copied
     * @returns {void}
     */
    appendWaypointsFrom(source: Mission) {
        this.waypoints.push(...cloneDeep(source.waypoints));
    }

    deleteWaypoint(waypointNum: number) {
        const index = this.storedIndex(waypointNum);
        if (index === undefined) return;
        this.waypoints.splice(index, 1);
        this.reindexSegmentsAfterRemoval(index);
    }

    /**
     * Replaces a waypoint's task. A detour waypoint never carries a task.
     *
     * @param {number} waypointNum 1-based visible waypoint number
     * @param {Task} task Task to give the waypoint
     * @returns {void}
     */
    setWaypointTask(waypointNum: number, task: Task) {
        const index = this.storedIndex(waypointNum);
        if (index === undefined || this.waypoints[index].getIsDetour()) return;
        this.waypoints[index].setTask(task);
    }

    /**
     * Puts back a waypoint's location and task from a copy saved before editing began,
     * leaving its flags and identity unchanged.
     *
     * @param {number} waypointNum 1-based visible waypoint number
     * @param {Waypoint} saved Copy of the waypoint taken before the edits
     * @returns {void}
     */
    revertWaypoint(waypointNum: number, saved: Waypoint) {
        const index = this.storedIndex(waypointNum);
        if (index === undefined || !saved) return;
        this.waypoints[index].setLocation(cloneDeep(saved.getLocation()));
        this.waypoints[index].setTask(cloneDeep(saved.getTask()));
    }

    private visibleWaypoints(): MissionWaypoint[] {
        return this.waypoints.filter((waypoint) => !waypoint.getIsSuppressed());
    }

    /** Stored array index of a 1-based visible waypoint number, or undefined if out of range. */
    private storedIndex(waypointNum: number): number | undefined {
        const waypoint = this.visibleWaypoints()[waypointNum - 1];
        return waypoint ? this.waypoints.indexOf(waypoint) : undefined;
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
        const index = this.storedIndex(waypointNum);
        if (index !== undefined) this.waypoints[index].setLocation(location);
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

        for (const waypoint of this.visibleWaypoints()) {
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
            // Files saved before the detour flag was renamed carry it as isBypass
            const { isBypass, ...fields } = serializedWaypoint;
            const waypoint = Object.assign(
                new MissionWaypoint(serializedWaypoint.location),
                fields,
            );
            if (isBypass) waypoint.setIsDetour(true);
            if (serializedWaypoint.task) {
                waypoint.setTask(Object.assign(new Task(), serializedWaypoint.task));
            }
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

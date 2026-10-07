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
import Waypoint, { MissionWaypoint, SegmentParams } from "../waypoints/waypoint";
import Task from "../tasks/task";
import { GhostParameters } from "../../types/jaia-system-types";
import { DEFAULT_SPEED, UNASSIGNED_ID } from "../../utils/constants";

export default class Mission {
    private missionID: number;
    private waypoints: MissionWaypoint[];
    private stationkeepSpeed: number;
    private repeats: number;
    /** Settings of the first segment, which always starts at goal 0. Later segments' are markers on waypoints. */
    private firstSegment: SegmentParams;
    private ghostParameters: GhostParameters;

    constructor() {
        // missionID assigned by missionSet singleton
        // speeds set by missionSet singleton
        this.waypoints = [];
        this.stationkeepSpeed = DEFAULT_SPEED;
        this.repeats = 1;
        this.firstSegment = {};
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

    getTransitSpeed(): number {
        return this.firstSegment.speed ?? DEFAULT_SPEED;
    }

    /** Sets the transit speed of every segment. */
    setTransitSpeed(speed: number) {
        this.firstSegment.speed = speed;
        for (const waypoint of this.waypoints) {
            const segmentStart = waypoint.getSegmentStart();
            if (segmentStart) segmentStart.speed = speed;
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

    getBottomDepthSafetyParams() {
        return this.firstSegment.bottom_depth_safety_params;
    }

    setBottomDepthSafetyParams(bottomDepthSafetyParams: BottomDepthSafetyParams) {
        this.firstSegment.bottom_depth_safety_params = bottomDepthSafetyParams;
    }

    /** The segments as they are sent to the bot, computed from the mission's markers. */
    getSegments(): Segment[] {
        return this.buildPlan().segments;
    }

    /**
     * Marks a waypoint as the start of a survey lane, where the bot resumes after a safety
     * return.
     *
     * @param {number} waypointNum 1-based visible waypoint number
     * @returns {void}
     */
    setLaneStart(waypointNum: number) {
        const index = this.storedIndex(waypointNum);
        if (index !== undefined) this.waypoints[index].setIsLaneStart(true);
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
     * Appends copies of another mission's stored waypoints, flags and markers included, so a
     * combined mission keeps each source's detours, suppressed waypoints and segments. The
     * source's first segment becomes this mission's first segment if this mission is empty,
     * and otherwise a marker on the source's first appended waypoint.
     *
     * @param {Mission} source Mission whose stored waypoints are copied
     * @returns {void}
     */
    appendWaypointsFrom(source: Mission) {
        if (source.waypoints.length === 0) return;
        const appended = cloneDeep(source.waypoints);
        if (!appended[0].getSegmentStart()) {
            appended[0].setSegmentStart(cloneDeep(source.firstSegment));
        }
        this.waypoints.push(...appended);
        this.promoteFirstMarker();
    }

    /**
     * Deletes a waypoint. A segment or lane start it carried moves to the next waypoint, unless
     * that waypoint already starts a segment, in which case the deleted one is dropped.
     *
     * @param {number} waypointNum 1-based visible waypoint number
     * @returns {void}
     */
    deleteWaypoint(waypointNum: number) {
        const index = this.storedIndex(waypointNum);
        if (index === undefined) return;
        const [deleted] = this.waypoints.splice(index, 1);
        const next = this.waypoints[index];
        if (next && !next.getSegmentStart()) {
            if (deleted.getSegmentStart()) {
                next.setSegmentStart(deleted.getSegmentStart());
                next.setIsLaneStart(false);
            } else if (deleted.getIsLaneStart()) {
                next.setIsLaneStart(true);
            }
        }
        this.promoteFirstMarker();
    }

    /**
     * Keeps the first segment's settings on Mission: a marker that ends up on the first stored
     * waypoint replaces them, since the segment they described has no waypoints left.
     *
     * @returns {void}
     */
    private promoteFirstMarker() {
        const first = this.waypoints[0];
        if (!first?.getSegmentStart()) return;
        this.firstSegment = first.getSegmentStart()!;
        first.setSegmentStart(undefined);
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

    moveWaypoint(waypointNum: number, location: GeographicCoordinate) {
        const index = this.storedIndex(waypointNum);
        if (index !== undefined) this.waypoints[index].setLocation(location);
    }

    packageMissionForHub(missionSetName: string) {
        const plan = this.buildPlan();
        const missionPlan: MissionPlan = {
            start: MissionStart.START_IMMEDIATELY,
            movement: MovementType.TRANSIT,
            goal: plan.goals,
            recovery: {
                recover_at_final_goal: true,
            },
            speeds: {
                transit: this.getTransitSpeed(),
                stationkeep_outer: this.getStationkeepSpeed(),
            },
            repeats: this.repeats,
            mission_name: missionSetName,
            segments: plan.segments,
        };

        return missionPlan;
    }

    /**
     * Builds the goals and segments sent to the bot in one pass over the stored waypoints, so
     * segment indices always count the goals sent with them. Suppressed waypoints are skipped;
     * whatever they mark carries to the next waypoint sent. A run of detours belongs to the
     * segment and lane of the operator waypoint after it.
     *
     * @returns {{ goals: Goal[], segments: Segment[] }} Goals and segments for the MissionPlan
     */
    private buildPlan(): { goals: Goal[]; segments: Segment[] } {
        const goals: Goal[] = [];
        const segments: Segment[] = [{ start_goal_index: 0, ...cloneDeep(this.firstSegment) }];
        let heldSegment: SegmentParams | undefined;
        let heldLaneStart = false;
        let detourRunStart: number | undefined;

        for (const waypoint of this.waypoints) {
            if (waypoint.getSegmentStart()) heldSegment = waypoint.getSegmentStart();
            if (waypoint.getIsLaneStart()) heldLaneStart = true;
            if (waypoint.getIsSuppressed()) continue;
            if (waypoint.getIsDetour()) {
                detourRunStart ??= goals.length;
                goals.push(waypoint.packageWaypointForHub());
                continue;
            }

            const start = detourRunStart ?? goals.length;
            detourRunStart = undefined;
            const open = segments[segments.length - 1];
            if (heldSegment) {
                // A segment opening where the previous one opened means that one has no goals
                const segment = { start_goal_index: start, ...cloneDeep(heldSegment) };
                if (open.start_goal_index === start) segments[segments.length - 1] = segment;
                else segments.push(segment);
            } else if (heldLaneStart && start > open.start_goal_index) {
                open.lane_start_goal_indices = [...(open.lane_start_goal_indices ?? []), start];
            }
            heldSegment = undefined;
            heldLaneStart = false;
            goals.push(waypoint.packageWaypointForHub());
        }

        return { goals, segments };
    }

    /**
     * Creates a mission object from serialized mission data
     *
     * @param {string} serializedMission Serialized Mission data to transform to Mission object
     * @returns {Mission} mission Resulting Mission object
     */
    static fromJSON(serializedMission: string) {
        // Older files carry segments as goal indices, and the oldest mission-level speeds
        const { segments, speeds: legacySpeeds, ...fields } = serializedMission as any;
        const mission = Object.assign(new Mission(), fields);
        mission.firstSegment = cloneDeep(fields.firstSegment ?? {});
        mission.waypoints = (fields.waypoints ?? []).map((serializedWaypoint: any) => {
            // Files saved before the detour flag was renamed carry it as isBypass
            const { isBypass, ...waypointFields } = serializedWaypoint;
            const waypoint = Object.assign(
                new MissionWaypoint(serializedWaypoint.location),
                waypointFields,
            );
            if (isBypass) waypoint.setIsDetour(true);
            if (serializedWaypoint.segmentStart) {
                waypoint.setSegmentStart(cloneDeep(serializedWaypoint.segmentStart));
            }
            if (serializedWaypoint.task) {
                waypoint.setTask(Object.assign(new Task(), serializedWaypoint.task));
            }
            return waypoint;
        });
        if (segments) mission.applyIndexedSegments(segments);
        mission.promoteFirstMarker();
        if (legacySpeeds?.transit !== undefined) {
            mission.firstSegment.speed ??= legacySpeeds.transit;
        }
        if (legacySpeeds?.stationkeep_outer !== undefined) {
            mission.setStationkeepSpeed(legacySpeeds.stationkeep_outer);
        }
        return mission;
    }

    /**
     * Converts segments stored as goal indices into the first segment's settings and markers
     * on the waypoints that start later segments and lanes. Files with indexed segments
     * predate suppression, so a goal index is a stored index.
     *
     * @param {Segment[]} segments Segments as saved, indexed by goal
     * @returns {void}
     */
    private applyIndexedSegments(segments: Segment[]) {
        for (const { start_goal_index, lane_start_goal_indices, ...params } of segments) {
            if (start_goal_index === 0) {
                this.firstSegment = cloneDeep(params);
            } else {
                this.waypoints[start_goal_index]?.setSegmentStart(cloneDeep(params));
            }
            for (const laneStart of lane_start_goal_indices ?? []) {
                this.waypoints[laneStart]?.setIsLaneStart(true);
            }
        }
    }
}

import * as mgrs from "mgrs";
import Task from "../tasks/task";
import { GeographicCoordinate, Goal, Segment } from "../../types/protobuf-types";
import { MGRS } from "../../types/jaia-system-types";
import { validateCoordinate } from "../../utils/input";
import { MGRS_PLACEHOLDER } from "../../utils/constants";

const defaultMGRS: MGRS = {
    gridZoneDesignator: MGRS_PLACEHOLDER,
    squareIdentifier: MGRS_PLACEHOLDER,
    easting: MGRS_PLACEHOLDER,
    northing: MGRS_PLACEHOLDER,
};

/** A segment's settings, without the goal indices that are computed when a mission is sent. */
export type SegmentParams = Omit<Segment, "start_goal_index" | "lane_start_goal_indices">;

/** A mission's waypoint as code outside Mission sees it: read-only. Only Mission changes waypoints. */
export default interface Waypoint {
    getLocation(): GeographicCoordinate;
    getTask(): Task;
    getIsDetour(): boolean;
    getIsSuppressed(): boolean;
    packageWaypointForHub(): Goal;
    latLonToMGRS(): MGRS;
}

/** The waypoint a Mission stores. Used only by Mission. */
export class MissionWaypoint implements Waypoint {
    private location: GeographicCoordinate;
    private task: Task;
    private isDetour: boolean = false;
    private isSuppressed: boolean = false;
    /** Settings of the segment this waypoint starts; never set on a mission's first segment. */
    private segmentStart?: SegmentParams;
    private isLaneStart: boolean = false;

    constructor(location: GeographicCoordinate) {
        this.location = location;
        this.task = new Task();
    }

    getLocation() {
        return this.location;
    }

    setLocation(location: GeographicCoordinate) {
        this.location = location;
    }

    getTask() {
        return this.task;
    }

    setTask(task: Task) {
        this.task = task;
    }

    setIsDetour(isDetour: boolean) {
        this.isDetour = isDetour;
    }

    getIsDetour() {
        return this.isDetour;
    }

    setIsSuppressed(isSuppressed: boolean) {
        this.isSuppressed = isSuppressed;
    }

    getIsSuppressed() {
        return this.isSuppressed;
    }

    setSegmentStart(segmentStart: SegmentParams | undefined) {
        this.segmentStart = segmentStart;
    }

    getSegmentStart() {
        return this.segmentStart;
    }

    setIsLaneStart(isLaneStart: boolean) {
        this.isLaneStart = isLaneStart;
    }

    getIsLaneStart() {
        return this.isLaneStart;
    }

    packageWaypointForHub(): Goal {
        return {
            location: this.location,
            task: this.task.packageTaskForHub(),
        };
    }

    /**
     * Converts the lat/lon of the waypoint to MGRS format
     *
     * @returns {MGRS} MGRS components for waypoints current location
     */
    latLonToMGRS(): MGRS {
        const [lat, lon] = validateCoordinate(
            this.location.lat?.toString(),
            this.location.lon?.toString(),
        );

        let mgrsStr = "";
        try {
            mgrsStr = mgrs.forward([Number(lon), Number(lat)]);
        } catch (err) {
            console.error("Failed to convert lat/lon to MGRS", err);
            return { ...defaultMGRS };
        }

        const match = mgrsStr.match(/^(\d{1,2}[C-X])([A-Z]{2})(\d*)$/);

        if (!match) {
            return { ...defaultMGRS };
        }

        // match[0] contains the entire MGRS string
        const gzd = match[1];
        const squareID = match[2];
        // Contains easting and northing concatenated together, each with the same number of digits
        const digits = match[3];
        const half = digits.length / 2;
        const mgrsComponents: MGRS = {
            gridZoneDesignator: gzd,
            squareIdentifier: squareID,
            easting: digits.slice(0, half),
            northing: digits.slice(half),
        };
        return mgrsComponents;
    }
}

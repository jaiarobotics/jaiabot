import * as mgrs from "mgrs";
import Task from "../tasks/task";
import { GeographicCoordinate, Goal } from "../../types/protobuf-types";
import { MGRS } from "../../types/jaia-system-types";
import { validateCoordinate } from "../../utils/input";
import { MGRS_PLACEHOLDER } from "../../utils/constants";

const defaultMGRS: MGRS = {
    gridZoneDesignator: MGRS_PLACEHOLDER,
    squareIdentifier: MGRS_PLACEHOLDER,
    easting: MGRS_PLACEHOLDER,
    northing: MGRS_PLACEHOLDER,
};

export default class Waypoint {
    private location: GeographicCoordinate;
    private task: Task;
    private isBypass: boolean = false;

    constructor() {
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

    setIsBypass(isBypass: boolean) {
        this.isBypass = isBypass;
    }

    getIsBypass() {
        return this.isBypass;
    }

    packageWaypointForHub() {
        const goal: Goal = {
            location: this.location,
            task: this.task.packageTaskForHub(),
        };

        if (this.isBypass) {
            goal.name = "route_bypass";
        }

        return goal;
    }

    /**
     * Converts the lat/lon of the waypoint to MGRS format
     *
     * @returns {MGRS} MGRS components for waypoints current location
     */
    latLonToMGRS() {
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

    /**
     * Converts an MGRS string to lat/lon coordinate
     *
     * @param {string} mgrsStr Location to convert
     * @returns {number[]} Coordinates [lon, lat]
     */
    mgrsToLonLat(mgrsStr: string) {
        try {
            const [lon, lat] = mgrs.toPoint(mgrsStr);
            return [lon, lat];
        } catch (err) {
            console.error("Failed to convert MGRS to lon/lat", err);
            return [NaN, NaN];
        }
    }
}

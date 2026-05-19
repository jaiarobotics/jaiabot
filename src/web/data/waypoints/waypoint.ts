import * as mgrs from "mgrs";
import Task from "../tasks/task";
import { GeographicCoordinate, Goal } from "../../types/protobuf-types";
import { CoordinateTypes, MGRS, MGRSComponents } from "../../types/jaia-system-types";

export default class Waypoint {
    private location: GeographicCoordinate;
    private task: Task;

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

    packageWaypointForHub() {
        const goal: Goal = {
            location: this.location,
            task: this.task.packageTaskForHub(),
        };

        return goal;
    }

    latLonToMGRS() {
        const mgrsStr = mgrs.forward([this.location.lon, this.location.lat]);
        const match = mgrsStr.match(/^(\d{1,2}[C-X])([A-Z]{2})(\d*)$/);

        if (!match) {
            return null;
        }

        const gzd = match[1];
        const squareID = match[2];
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

    mgrsToLatLon(mgrsStr: string) {
        try {
            const [lon, lat] = mgrs.toPoint(mgrsStr);
            return [lon, lat];
        } catch (err) {
            console.log(err);
            return [NaN, NaN];
        }
    }
}

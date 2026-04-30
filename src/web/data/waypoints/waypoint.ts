import Task from "../tasks/task";

import { MGRS } from "../../types/jaia-system-types";
import { GeographicCoordinate, Goal } from "../../types/protobuf-types";

export default class Waypoint {
    private location: GeographicCoordinate;
    private mgrsLocation: MGRS;
    private task: Task;

    constructor() {
        this.task = new Task();
        this.mgrsLocation = {
            gridZoneDesignator: "",
            squareIdentifier: "",
            easting: "",
            northing: "",
        };
    }

    getLocation() {
        return this.location;
    }

    setLocation(location: GeographicCoordinate) {
        this.location = location;
    }

    getMGRSLocation() {
        return this.mgrsLocation;
    }

    setMGRSLocation(mgrsLocation: MGRS) {
        this.mgrsLocation = mgrsLocation;
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
}

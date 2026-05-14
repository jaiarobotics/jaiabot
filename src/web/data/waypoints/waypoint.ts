import Task from "../tasks/task";

import { GeographicCoordinate, Goal } from "../../types/protobuf-types";

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
}

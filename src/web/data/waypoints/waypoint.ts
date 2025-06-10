import Task from "../tasks/task";

import { GeographicCoordinate, Goal } from "../../types/protobuf-types";

export default class Waypoint {
    private location: GeographicCoordinate;
    private isMovable: boolean;
    private task: Task;

    constructor() {
        this.task = new Task();
        this.isMovable = false;
    }

    getLocation() {
        return this.location;
    }

    setLocation(location: GeographicCoordinate) {
        this.location = location;
    }

    getIsMovable() {
        return this.isMovable;
    }

    setIsMovable(isMovable: boolean) {
        this.isMovable = isMovable;
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

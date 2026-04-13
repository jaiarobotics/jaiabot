import Task from "../tasks/task";

import { GeographicCoordinate, Goal } from "../../types/protobuf-types";

export default class Waypoint {
    private location: GeographicCoordinate;
    private task: Task;
    private name?: string;

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

    setName(name: string) {
        this.name = name;
    }

    getName() {
        return this.name;
    }

    packageWaypointForHub() {
        const goal: Goal = {
            location: this.location,
            task: this.task.packageTaskForHub(),
        };

        if (this.name !== undefined) {
            goal.name = this.name;
        }

        return goal;
    }
}

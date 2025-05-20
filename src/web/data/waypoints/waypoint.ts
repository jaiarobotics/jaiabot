import { GeographicCoordinate, Goal } from "../../types/protobuf-types";
import Task from "../tasks/task";

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
}

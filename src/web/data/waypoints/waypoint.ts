import { GeographicCoordinate } from "../../utils/protobuf-types";
import Task from "../tasks/task";

export default class Waypoint {
    private location: GeographicCoordinate;
    private task: Task;

    constructor() {}

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
}

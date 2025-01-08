import { GeographicCoordinate } from "../../utils/protobuf-types";
import Task from "../tasks/task";

export default class Waypoint {
    private position: GeographicCoordinate;
    private task: Task;
    private canMoveOnMap: boolean;

    constructor() {}

    getPosition() {
        return this.position;
    }

    setPosition(position: GeographicCoordinate) {
        this.position = position;
    }

    getTask() {
        return this.task;
    }

    setTask(task: Task) {
        this.task = task;
    }

    getCanMoveOnMap() {
        return this.canMoveOnMap;
    }

    setCanMoveOnMap(canMoveOnMap: boolean) {
        this.canMoveOnMap = canMoveOnMap;
    }
}

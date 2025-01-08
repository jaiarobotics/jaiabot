import { DivePacket, DriftPacket, TaskType } from "../../utils/protobuf-types";

export default class TaskPacket {
    private startTime: number;
    private endTime: number;
    private taskType: TaskType;
    private divePacket: DivePacket;
    private driftPacket: DriftPacket;

    constructor() {}

    getStartTime() {
        return this.startTime;
    }

    setStartTime(startTime: number) {
        this.startTime = startTime;
    }

    getEndTime() {
        return this.endTime;
    }

    setEndTime(endTime: number) {
        this.endTime = endTime;
    }

    getTaskType() {
        return this.taskType;
    }

    setTaskType(taskType: TaskType) {
        this.taskType = taskType;
    }

    getDivePacket() {
        return this.divePacket;
    }

    setDivePacket(divePacket: DivePacket) {
        this.divePacket = divePacket;
    }

    getDriftPacket() {
        return this.driftPacket;
    }

    setDriftPacket(driftPacket: DriftPacket) {
        this.driftPacket = driftPacket;
    }
}

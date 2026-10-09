import { TaskPacket } from "../../types/protobuf-types";

export class TaskPackets {
    private includedTaskPackets: TaskPacket[];
    private excludedTaskPackets: TaskPacket[];
    private version: number;
    private revision: number;

    constructor() {
        this.includedTaskPackets = [];
        this.excludedTaskPackets = [];
        this.revision = 0;
    }

    getIncludedTaskPackets() {
        return this.includedTaskPackets;
    }

    setIncludedTaskPackets(taskPackets: TaskPacket[]) {
        this.includedTaskPackets = taskPackets;
        this.revision += 1;
    }

    getExcludedTaskPackets() {
        return this.excludedTaskPackets;
    }

    setExcludedTaskPackets(taskPackets: TaskPacket[]) {
        this.excludedTaskPackets = taskPackets;
        this.revision += 1;
    }

    getVersion() {
        return this.version;
    }

    setVersion(version: number) {
        this.version = version;
    }

    getRevision() {
        return this.revision;
    }

    getTaskPacket(botID: number, startTime: number) {
        const allTaskPackets = this.includedTaskPackets.concat(this.excludedTaskPackets);
        for (const taskPacket of allTaskPackets) {
            if (taskPacket.start_time === startTime && taskPacket.bot_id === botID) {
                return taskPacket;
            }
        }
    }
}

export const taskPackets = new TaskPackets();

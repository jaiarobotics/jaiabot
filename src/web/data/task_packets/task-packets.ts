import { TaskPacket } from "../../types/protobuf-types";

export class TaskPackets {
    private includedTaskPackets: TaskPacket[];
    private excludedTaskPackets: TaskPacket[];
    private version: number;

    constructor() {
        this.includedTaskPackets = [];
        this.excludedTaskPackets = [];
    }

    getIncludedTaskPackets() {
        return this.includedTaskPackets;
    }

    setIncludedTaskPackets(taskPackets: TaskPacket[]) {
        this.includedTaskPackets = taskPackets;
    }

    getExcludedTaskPackets() {
        return this.excludedTaskPackets;
    }

    setExcludedTaskPackets(taskPackets: TaskPacket[]) {
        this.excludedTaskPackets = taskPackets;
    }

    getVersion() {
        return this.version;
    }

    setVersion(version: number) {
        this.version = version;
    }
}

export const taskPackets = new TaskPackets();

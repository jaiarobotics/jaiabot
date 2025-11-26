import { TaskPacket } from "../../types/protobuf-types";

export class TaskPackets {
    private taskPackets: TaskPacket[];
    private includedTaskPackets: TaskPacket[];
    private excludedTaskPackets: TaskPacket[];

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
}

export const taskPackets = new TaskPackets();

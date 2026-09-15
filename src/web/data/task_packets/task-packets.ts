import { TaskPacket } from "../../shared/proto/jaiabot/messages/jaia_dccl";

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

    getTaskPacket(botID: number, startTime: number) {
        const allTaskPackets = this.includedTaskPackets.concat(this.excludedTaskPackets);
        for (const taskPacket of allTaskPackets) {
            if (Number(taskPacket.start_time) === startTime && taskPacket.bot_id === botID) {
                return taskPacket;
            }
        }
    }
}

export const taskPackets = new TaskPackets();

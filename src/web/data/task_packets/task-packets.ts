import { TaskPacket } from "../../types/protobuf-types";

class TaskPackets {
    private taskPackets: TaskPacket[];

    getTaskPackets() {
        return this.taskPackets;
    }

    setTaskPackets(taskPackets: TaskPacket[]) {
        this.taskPackets = taskPackets;
    }
}

export const taskPackets = new TaskPackets();

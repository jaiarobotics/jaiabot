import { LogTaskPacket } from "./LogMessages";
import { TaskPacket } from "./JAIAProtobuf";
export declare class KMLDocument {
    #private;
    constructor();
    setTaskPackets(taskPackets: (TaskPacket | LogTaskPacket)[]): void;
    getTaskPackets(): (TaskPacket | LogTaskPacket)[];
    getKML(): Promise<string>;
    getKMZ(): Promise<Blob>;
}

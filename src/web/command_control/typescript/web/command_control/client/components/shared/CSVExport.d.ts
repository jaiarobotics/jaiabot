import { TaskPacket } from './JAIAProtobuf';
import { LogTaskPacket } from './LogMessages';
export declare function getCSV(taskPackets: (TaskPacket | LogTaskPacket)[]): Promise<string>;
export declare function getCSVFilename(taskPackets: TaskPacket[]): string;

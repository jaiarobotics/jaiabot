import { Command, TaskPacket } from "./JAIAProtobuf";
export interface LogMessage {
    _utime_: number;
    _scheme_: number;
}
export type LogCommand = (Command & LogMessage);
export type LogTaskPacket = (TaskPacket & LogMessage);

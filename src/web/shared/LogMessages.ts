import { Command, TaskPacket } from "./JAIAProtobuf"

// Logs have an added _utime_ field on Commands
export interface LogCommand extends Command {
    _utime_: number
    _scheme_: number
}

export interface LogTaskPacket extends TaskPacket {
    _utime_: number
    _scheme_: number
}

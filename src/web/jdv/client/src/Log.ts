import { Command, TaskPacket } from "./shared/JAIAProtobuf"


export interface Log {
    filename: string
    fleet: string
    bot: string
    timestamp: number
    duration: number
}

// Logs have an added _utime_ field on Commands
export interface LogCommand extends Command {
    _utime_: number
    _scheme_: number
}

export interface LogTaskPacket extends TaskPacket {
    _utime_: number
    _scheme_: number
}

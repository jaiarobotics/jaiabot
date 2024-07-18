import { Command, TaskPacket } from "./JAIAProtobuf";

/**
 * Messages stored in Jaia .goby and .h5 files that contain a few extra fields
 *
 * @interface LogMessage
 */
export interface LogMessage {
    /**
     * Unix timestamp in microseconds since the Unix epoch
     *
     * @type {number}
     */
    _utime_: number;

    /**
     * Encoding scheme, where 1 is for intravehicle, non-DCCL messages
     * (with more precision than the equivalent DCCL messages)
     *
     * @type {number}
     */
    _scheme_: number;
}

export type LogCommand = Command & LogMessage;
export type LogTaskPacket = TaskPacket & LogMessage;

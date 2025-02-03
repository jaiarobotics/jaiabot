import { CommandType, HubCommandType } from "../utils/protobuf-types";

export interface CommandInfo {
    commandType: CommandType | HubCommandType;
    description: string;
    confirmationButtonText: string;
    statesAvailable?: RegExp[];
    statesNotAvailable?: RegExp[];
    humanReadableAvailable?: string;
    humanReadableNotAvailable?: string;
}

export const botCommands: { [key: string]: CommandInfo } = {
    active: {
        commandType: CommandType.ACTIVATE,
        description: "system check",
        confirmationButtonText: "Run System Check",
        statesAvailable: [/^.+__IDLE$/, /^PRE_DEPLOYMENT__FAILED$/],
        humanReadableAvailable: "*__IDLE, PRE_DEPLOYMENT__FAILED",
        humanReadableNotAvailable: "",
    },
    nextTask: {
        commandType: CommandType.NEXT_TASK,
        description: "go to the Next Task for",
        confirmationButtonText: "Go To Next Task",
        statesAvailable: [/^IN_MISSION__.+$/],
        statesNotAvailable: [/REMOTE_CONTROL/],
        humanReadableAvailable: "IN_MISSION__*",
        humanReadableNotAvailable: "*REMOTE_CONTROL*",
    },
    goHome: {
        commandType: CommandType.RETURN_TO_HOME,
        description: "Return Home",
        confirmationButtonText: "Return Home",
        statesAvailable: [/^IN_MISSION__.+$/],
        humanReadableAvailable: "IN_MISSION__*",
        humanReadableNotAvailable: "",
    },
    stop: {
        commandType: CommandType.STOP,
        description: "Stop",
        confirmationButtonText: "Stop",
        statesAvailable: [/^IN_MISSION__.+$/],
        statesNotAvailable: [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/],
        humanReadableAvailable: "IN_MISSION__*",
        humanReadableNotAvailable: "IN_MISSION__UNDERWAY__RECOVERY__STOPPED",
    },
    play: {
        commandType: CommandType.START_MISSION,
        description: "Play mission",
        confirmationButtonText: "Play Mission",
        statesAvailable: [/^IN_MISSION__.+$/, /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/],
        humanReadableAvailable: "IN_MISSION__*, PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN",
        humanReadableNotAvailable: "",
    },
    rcMode: {
        commandType: CommandType.REMOTE_CONTROL_TASK,
        description: "RC mission",
        confirmationButtonText: "RC Mission",
        statesAvailable: [
            /^IN_MISSION__.+$/,
            /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/,
            /^.+__FAILED$/,
        ],
        humanReadableAvailable: "IN_MISSION__*, PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN, *__FAILED",
        humanReadableNotAvailable: "",
    },
    recover: {
        commandType: CommandType.RECOVERED,
        description: "Recover",
        confirmationButtonText: "Recover",
        statesAvailable: [/^PRE_DEPLOYMENT.+$/, /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/],
        humanReadableAvailable: "PRE_DEPLOYMENT*, IN_MISSION__UNDERWAY__RECOVERY__STOPPED",
        humanReadableNotAvailable: "",
    },
    retryDataOffload: {
        commandType: CommandType.RETRY_DATA_OFFLOAD,
        description: "Retry Data Offload for",
        confirmationButtonText: "Retry Data Offload",
        statesAvailable: [/^POST_DEPLOYMENT__FAILED$/],
        humanReadableAvailable: "POST_DEPLOYMENT__IDLE, POST_DEPLOYMENT__WAIT_FOR_MISSION_PLAN",
        humanReadableNotAvailable: "",
    },
    shutdown: {
        commandType: CommandType.SHUTDOWN,
        description: "Shutdown",
        confirmationButtonText: "Shutdown",
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ],
        humanReadableAvailable:
            "IN_MISSION__UNDERWAY__RECOVERY__STOPPED, PRE_DEPLOYMENT*, POST_DEPLOYMENT*",
        humanReadableNotAvailable: "",
    },
    restartServices: {
        commandType: CommandType.RESTART_ALL_SERVICES,
        description: "Restart Services for",
        confirmationButtonText: "Restart Services",
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ],
        humanReadableAvailable:
            "IN_MISSION__UNDERWAY__RECOVERY__STOPPED, PRE_DEPLOYMENT*, POST_DEPLOYMENT*",
        humanReadableNotAvailable: "",
    },
    reboot: {
        commandType: CommandType.REBOOT_COMPUTER,
        description: "Reboot",
        confirmationButtonText: "Reboot",
        statesAvailable: [
            /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
            /^PRE_DEPLOYMENT.+$/,
            /^POST_DEPLOYMENT.+$/,
        ],
        humanReadableAvailable:
            "IN_MISSION__UNDERWAY__RECOVERY__STOPPED, PRE_DEPLOYMENT*, POST_DEPLOYMENT*",
        humanReadableNotAvailable: "",
    },
};

export const hubCommands: { [key: string]: CommandInfo } = {
    shutdown: {
        commandType: CommandType.SHUTDOWN_COMPUTER,
        description: "Shutdown Hub",
        confirmationButtonText: "Shutdown Hub",
        statesNotAvailable: [],
    },
    restartServices: {
        commandType: CommandType.RESTART_ALL_SERVICES,
        description: "Restart Services",
        confirmationButtonText: "Restart Services",
        statesNotAvailable: [],
    },
    reboot: {
        commandType: CommandType.REBOOT_COMPUTER,
        description: "Reboot Hub",
        confirmationButtonText: "Reboot Hub",
        statesNotAvailable: [],
    },
};

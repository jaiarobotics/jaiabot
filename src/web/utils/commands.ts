import { Command, CommandType, HubCommandType, BotStatus, MissionState, HubStatus } from '../shared/JAIAProtobuf'
import { jaiaAPI } from '../jcc/common/JaiaAPI'
import { CustomAlert } from '../shared/CustomAlert'

export interface CommandInfo {
    commandType: CommandType | HubCommandType,
    description: string,
    confirmationButtonText: string,
    statesAvailable?: RegExp[],
    statesNotAvailable?: RegExp[],
    humanReadableAvailable?: string,
    humanReadableNotAvailable?: string
}

export const hubCommands: {[key: string]: CommandInfo} = {
    shutdown: {
        commandType: CommandType.SHUTDOWN_COMPUTER,
        description: 'Shutdown Hub',
        confirmationButtonText: 'Shutdown Hub',
        statesNotAvailable: [
        ]
    },
    restartServices: {
        commandType: CommandType.RESTART_ALL_SERVICES,
        description: 'Restart Services',
        confirmationButtonText: 'Restart Services',
        statesNotAvailable: [
        ]
    },
    reboot: {
        commandType: CommandType.REBOOT_COMPUTER,
        description: 'Reboot Hub',
        confirmationButtonText: 'Reboot Hub',
        statesNotAvailable: [
        ]
    }
}

export async function sendHubCommand(hubID: number, hubCommand: CommandInfo) {
    if (await CustomAlert.confirmAsync("Are you sure you'd like to " + hubCommand.description + '?', hubCommand.confirmationButtonText)) {
        const command = {
            hub_id: hubID,
            type: hubCommand.commandType as HubCommandType
        }
        jaiaAPI.postCommandForHub(command)
    }
}

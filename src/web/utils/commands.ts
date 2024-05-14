import { Command, CommandType, HubCommandType, BotStatus, MissionState, HubStatus } from '../shared/JAIAProtobuf'
import { jaiaAPI } from '../jcc/common/JaiaAPI'
import { CustomAlert } from '../shared/CustomAlert'
import { isError } from 'lodash'

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

/**
 * Saves the client ID associated with the user session as the controlling client ID
 * 
 * @param {string} clientID ID associated with user session
 * @returns {boolean} Whether or not the client took control
 */
export async function takeControl(clientID: string) {
    const status = await jaiaAPI.getStatus()

    if (isError(status)) {
        console.error('Error retrieving status message')
        return false
    }

    if (clientID === status['controllingClientId']) {
        return true
    }

    const didConfirm = await CustomAlert.confirmAsync('Another client is currently controlling the pod.  Take control?', 'Take Control')
    if (didConfirm) {
        const response = await jaiaAPI.takeControl()
        if (!isError(response)) {
            return true
        }
        return false
    }
    return false
}

/**
 * Posts command to the server so it can be passed to the hub
 * 
 * @param {number} hubID Determines which hub receives the command
 * @param {CommandInfo} hubCommand Contains the contents of the command
 * @returns {void}
 */
export async function sendHubCommand(hubID: number, hubCommand: CommandInfo) {
    const didConfirm = await CustomAlert.confirmAsync("Are you sure you'd like to " + hubCommand.description + '?', hubCommand.confirmationButtonText)
    if (didConfirm) {
        const command = {
            hub_id: hubID,
            type: hubCommand.commandType as HubCommandType
        }
        jaiaAPI.postCommandForHub(command)
    }
}

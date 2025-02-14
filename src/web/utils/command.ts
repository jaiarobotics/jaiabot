import { jaiaAPI } from "./jaia-api";
import { CustomAlert } from "../shared/CustomAlert";
import { CommandInfo } from "../types/commands";
import { Command, CommandType, HubCommandType, MissionState } from "./protobuf-types";
import { error } from "../notifications/notifications";
import { isError } from "lodash";

/**
 * commandStates is a map of command types to regular expressions that include all of the states of a Bot for which a command can be sent
 */
const commandStates: Map<CommandType, RegExp[]> = new Map<CommandType, RegExp[]>();
commandStates.set(CommandType.ACTIVATE, [/^.+__IDLE$/, /^PRE_DEPLOYMENT__FAILED$/]);
commandStates.set(CommandType.NEXT_TASK, [/^IN_MISSION__(?!REMOTE_CONTROL).+$/]);
commandStates.set(CommandType.REBOOT_COMPUTER, [
    /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
    /^PRE_DEPLOYMENT.+$/,
    /^POST_DEPLOYMENT.+$/,
]);
commandStates.set(CommandType.RECOVERED, [
    /^PRE_DEPLOYMENT.+$/,
    /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
]);
commandStates.set(CommandType.REMOTE_CONTROL_TASK, [
    /^IN_MISSION__.+$/,
    /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/,
    /^.+__FAILED$/,
]);
commandStates.set(CommandType.RESTART_ALL_SERVICES, [
    /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
    /^PRE_DEPLOYMENT.+$/,
    /^POST_DEPLOYMENT.+$/,
]);
commandStates.set(CommandType.RETRY_DATA_OFFLOAD, [/^POST_DEPLOYMENT__FAILED$/]);
commandStates.set(CommandType.RETURN_TO_HOME, [/^IN_MISSION__.+$/]);
commandStates.set(CommandType.SHUTDOWN, [
    /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/,
    /^PRE_DEPLOYMENT.+$/,
    /^POST_DEPLOYMENT.+$/,
]);
commandStates.set(CommandType.START_MISSION, [
    /^IN_MISSION__.+$/,
    /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/,
]);
commandStates.set(CommandType.STOP, [/^IN_MISSION__(?!UNDERWAY__RECOVERY__STOPPED).+$/]);

/**
 * Tests a mission state against the available states of a command
 *
 * @param {CommandType} command Command to check available states
 * @param {MissionState} missionState Bot's state to match against
 * @returns {boolean} True if the command is available for the given mission state, otherwise, false
 */
export function isCommandAvailable(command: CommandType, missionState: MissionState) {
    const availableStates = commandStates.get(command);

    for (let availableState of availableStates) {
        if (availableState.test(missionState)) {
            return true;
        }
    }
    return false;
}

/**
 * Saves client ID associated with the user session as the controlling client ID
 *
 * @param {string} clientID ID associated with user session
 * @returns {boolean} Whether or not the client took control
 */
export async function takeControl(clientID: string) {
    const status = await jaiaAPI.getStatus();

    if (isError(status)) {
        console.error("Error retrieving status message");
        return false;
    }

    if (clientID === status["controllingClientId"]) {
        return true;
    }

    const didConfirm = await CustomAlert.confirmAsync(
        "Another client is currently controlling the pod.  Take control?",
        "Take Control",
    );
    if (didConfirm) {
        const response = await jaiaAPI.takeControl();
        if (!isError(response)) {
            return true;
        }
        return false;
    }
    return false;
}

/**
 * Posts command to the server so it can be passed to the hub
 *
 * @param {number} hubID Determines which hub receives the command
 * @param {CommandInfo} hubCommand Contains the contents of the command
 * @returns {void}
 */
export async function sendHubCommand(hubID: number, hubCommand: CommandInfo) {
    const didConfirm = await CustomAlert.confirmAsync(
        "Are you sure you'd like to " + hubCommand.description + "?",
        hubCommand.confirmationButtonText,
    );
    if (didConfirm) {
        const command = {
            hub_id: hubID,
            type: hubCommand.commandType as HubCommandType,
        };
        jaiaAPI.postCommandForHub(command);
    }
}

export function sendBotCommand(botId: number, command: CommandInfo) {
    let c = {
        bot_id: botId,
        type: command.commandType as CommandType,
    };

    jaiaAPI.postCommand(c).then((response) => {
        if (response.message) {
            error(response.message);
        }
    });
}

export function sendBotRunCommand(botRun: Command) {
    jaiaAPI.postCommand(botRun).then((response) => {
        if (response.message) {
            error(response.message);
        }
    });
}

export function sendBotRCCommand(botMission: Command) {
    jaiaAPI.postCommand(botMission).then((response) => {
        if (response.message) {
            error(response.message);
        }
    });
}

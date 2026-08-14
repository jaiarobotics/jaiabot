import { jaiaAPI } from "./jaia-api";
import { Engineering } from "../shared/proto/jaiabot/messages/engineering";
import {
    Command,
    CommandForHub,
    Command_CommandType,
} from "../shared/proto/jaiabot/messages/jaia_dccl";
import { MissionState } from "../shared/proto/jaiabot/messages/mission";
import { jaiaGlobal } from "../data/jaia_global/jaia-global";

/**
 * commandStates is a map of command types to regular expressions
 * that include all of the states of a Bot for which a command can be sent
 */
const commandStates: Map<Command_CommandType, RegExp[]> = new Map<Command_CommandType, RegExp[]>([
    [Command_CommandType.ACTIVATE, [/^.+__IDLE$/, /^PRE_DEPLOYMENT__FAILED$/]],
    [Command_CommandType.NEXT_TASK, [/^IN_MISSION__(?!REMOTE_CONTROL).+$/]],
    [
        Command_CommandType.REBOOT_COMPUTER,
        [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/, /^PRE_DEPLOYMENT.+$/, /^POST_DEPLOYMENT.+$/],
    ],
    [
        Command_CommandType.RECOVERED,
        [/^PRE_DEPLOYMENT.+$/, /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/],
    ],
    [
        Command_CommandType.REMOTE_CONTROL_TASK,
        [/^IN_MISSION__.+$/, /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/, /^.+__FAILED$/],
    ],
    [
        Command_CommandType.RESTART_ALL_SERVICES,
        [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/, /^PRE_DEPLOYMENT.+$/, /^POST_DEPLOYMENT.+$/],
    ],
    [Command_CommandType.RETRY_DATA_OFFLOAD, [/^POST_DEPLOYMENT__FAILED$/]],
    [Command_CommandType.RETURN_TO_HOME, [/^IN_MISSION__.+$/]],
    [
        Command_CommandType.SHUTDOWN,
        [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/, /^PRE_DEPLOYMENT.+$/, /^POST_DEPLOYMENT.+$/],
    ],
    [
        Command_CommandType.START_MISSION,
        [/^IN_MISSION__.+$/, /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/],
    ],
    [Command_CommandType.STOP, [/^IN_MISSION__(?!UNDERWAY__RECOVERY__STOPPED).+$/]],
]);

/**
 * Tests a mission state against the available states of a command
 *
 * @param {Command_CommandType} commandType Command to check available states
 * @param {MissionState} missionState Bot's state to match against
 * @returns {boolean} True if the command is available for the given mission state, otherwise, false
 */
export function isCommandAvailable(commandType: Command_CommandType, missionState: MissionState) {
    const availableStates = commandStates.get(commandType);

    for (let availableState of availableStates) {
        if (availableState.test(missionState)) {
            return true;
        }
    }
    return false;
}

/**
 * Passes a command message for a Bot to the jaiaAPI
 * so it can reach the Hub for distribution
 *
 * @param {Command} command Command message to be sent to Bot
 * @returns {Promise} Response from sending command
 */
export function sendBotCommand(command: Command) {
    return jaiaAPI.postCommand(command);
}

/**
 * Passes a command message for a Hub to the jaiaAPI so it can reach the Hub
 *
 * @param {Command} command Command message to be sent to Hub
 * @returns {Promise} Response from sending command
 */
export function sendHubCommand(command: CommandForHub) {
    return jaiaAPI.postCommandForHub(command);
}

/**
 * Passes a engineering command message for a Bot to the jaiaAPI
 * so it can reach the Hub for distribution
 *
 * @param {Engineering} command Engineering command message to be sent to Bot
 * @returns {Promise} Response from sending command
 */
export function sendEngineeringCommand(command: Engineering) {
    return jaiaAPI.postEngineering(command);
}

/*
 * Checks whether the client is in control
 *
 * @returns {boolean} True if the client is in control, otherwise false
 */
export function isControllingClient() {
    const controllingID = jaiaGlobal.getControllingClientID();
    if (controllingID === jaiaAPI.getClientId() || controllingID === null) {
        return true;
    }

    return false;
}

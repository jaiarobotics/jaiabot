import { jaiaAPI } from "./jaia-api";
import { Command, CommandForHub, CommandType, MissionState } from "./protobuf-types";

/**
 * commandStates is a map of command types to regular expressions
 * that include all of the states of a Bot for which a command can be sent
 */
const commandStates: Map<CommandType, RegExp[]> = new Map<CommandType, RegExp[]>([
    [CommandType.ACTIVATE, [/^.+__IDLE$/, /^PRE_DEPLOYMENT__FAILED$/]],
    [CommandType.NEXT_TASK, [/^IN_MISSION__(?!REMOTE_CONTROL).+$/]],
    [
        CommandType.REBOOT_COMPUTER,
        [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/, /^PRE_DEPLOYMENT.+$/, /^POST_DEPLOYMENT.+$/],
    ],
    [CommandType.NEXT_TASK, [/^IN_MISSION__(?!REMOTE_CONTROL).+$/]],
    [
        CommandType.REBOOT_COMPUTER,
        [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/, /^PRE_DEPLOYMENT.+$/, /^POST_DEPLOYMENT.+$/],
    ],
    [CommandType.RECOVERED, [/^PRE_DEPLOYMENT.+$/, /^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/]],
    [
        CommandType.REMOTE_CONTROL_TASK,
        [/^IN_MISSION__.+$/, /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/, /^.+__FAILED$/],
    ],
    [
        CommandType.RESTART_ALL_SERVICES,
        [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/, /^PRE_DEPLOYMENT.+$/, /^POST_DEPLOYMENT.+$/],
    ],
    [CommandType.RETRY_DATA_OFFLOAD, [/^POST_DEPLOYMENT__FAILED$/]],
    [CommandType.RETURN_TO_HOME, [/^IN_MISSION__.+$/]],
    [
        CommandType.SHUTDOWN,
        [/^IN_MISSION__UNDERWAY__RECOVERY__STOPPED$/, /^PRE_DEPLOYMENT.+$/, /^POST_DEPLOYMENT.+$/],
    ],
    [CommandType.START_MISSION, [/^IN_MISSION__.+$/, /^PRE_DEPLOYMENT__WAIT_FOR_MISSION_PLAN$/]],
    [CommandType.STOP, [/^IN_MISSION__(?!UNDERWAY__RECOVERY__STOPPED).+$/]],
]);

/**
 * Tests a mission state against the available states of a command
 *
 * @param {CommandType} commandType Command to check available states
 * @param {MissionState} missionState Bot's state to match against
 * @returns {boolean} True if the command is available for the given mission state, otherwise, false
 */
export function isCommandAvailable(commandType: CommandType, missionState: MissionState) {
    const availableStates = commandStates.get(commandType);

    for (let availableState of availableStates) {
        if (availableState.test(missionState)) {
            return true;
        }
    }
    return false;
}

/**
 * Passes a command message for a Bot to the jaiaAPI so it can reach the Hub for distribution
 *
 * @param {Command} command Command message to be sent to Bot
 * @returns {void}
 */
export function sendBotCommand(command: Command) {
    jaiaAPI.postCommand(command);
}

/**
 * Passes a command message for a Hub to the jaiaAPI so it can reach the Hub
 *
 * @param {Command} command Command message to be sent to Hub
 * @returns {void}
 */
export function sendHubCommand(command: CommandForHub) {
    jaiaAPI.postCommandForHub(command);
}

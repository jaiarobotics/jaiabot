import { jaia_rest_api, JaiaRESTAPIError } from "./jaia-rest-api";
import { error } from "./notifications";
import { Engineering } from "@proto/jaiabot/messages/engineering";
import { APIRequest, APIResponse } from "@proto/jaiabot/messages/rest_api";
import { Command, CommandForHub, Command_CommandType } from "@proto/jaiabot/messages/jaia_dccl";
import { MissionState } from "@proto/jaiabot/messages/mission";
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

export interface SendOptions {
    /** Show an error notification if the command could not be sent (default true) */
    notifyOnError?: boolean;
}

/**
 * Sends a request to the REST API, resolving with the error rather than rejecting, so that a
 * caller sending to several Bots in turn carries on after one of them fails
 *
 * @param {APIRequest} request Request to send
 * @param {string} description What is being sent and to whom, for the error notification
 * @param {SendOptions} options Whether to notify the operator on failure
 * @returns {Promise<APIResponse>} The response, or one with only error set if the request failed
 */
async function sendRequest(
    request: APIRequest,
    description: string,
    options: SendOptions = {},
): Promise<APIResponse> {
    try {
        return await jaia_rest_api.request(request);
    } catch (e) {
        const apiError = e instanceof JaiaRESTAPIError ? e : undefined;
        const details = String((e as Error)?.message ?? e);
        if (options.notifyOnError ?? true) {
            error(`Could not send ${description}: ${details}`);
        }
        return { error: { code: apiError?.code, details } };
    }
}

/**
 * Passes a command message for a Bot to the REST API
 * so it can reach the Hub for distribution
 *
 * @param {Command} command Command message to be sent to Bot
 * @param {SendOptions} options Whether to notify the operator on failure
 * @returns {Promise<APIResponse>} Response from sending command, with error set if it was not sent
 */
export function sendBotCommand(command: Command, options?: SendOptions) {
    return sendRequest(
        {
            target: {
                bots: [command.bot_id ?? 0],
            },
            command: command,
        },
        `${command.type} to Bot ${command.bot_id}`,
        options,
    );
}

/**
 * Passes a command message for a Hub to the REST API so it can reach the Hub
 *
 * @param {Command} command Command message to be sent to Hub
 * @param {SendOptions} options Whether to notify the operator on failure
 * @returns {Promise<APIResponse>} Response from sending command, with error set if it was not sent
 */
export function sendHubCommand(command: CommandForHub, options?: SendOptions) {
    return sendRequest(
        {
            target: {
                hubs: [command.hub_id ?? 0],
            },
            command_for_hub: command,
        },
        `${command.type} to Hub ${command.hub_id}`,
        options,
    );
}

/**
 * Passes a engineering command message for a Bot to the REST API
 * so it can reach the Hub for distribution
 *
 * @param {Engineering} command Engineering command message to be sent to Bot
 * @param {SendOptions} options Whether to notify the operator on failure
 * @returns {Promise<APIResponse>} Response from sending command, with error set if it was not sent
 */
export function sendEngineeringCommand(command: Engineering, options?: SendOptions) {
    return sendRequest(
        {
            target: {
                bots: [command.bot_id ?? 0],
            },
            engineering_command: command,
        },
        `engineering command to Bot ${command.bot_id}`,
        options,
    );
}

/*
 * Checks whether the client is in control
 *
 * @returns {boolean} True if the client is in control, otherwise false
 */
export function isControllingClient() {
    const controllingID = jaiaGlobal.getControllingClientID();
    if (controllingID === jaia_rest_api.client_id || controllingID === null) {
        return true;
    }

    return false;
}

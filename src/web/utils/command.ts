import { Command, CommandType, HubCommandType } from "./protobuf-types";
import { jaiaAPI } from "./jaia-api";
import { CustomAlert } from "../shared/CustomAlert";
import { isError } from "lodash";
import { CommandInfo } from "../types/commands";
import { error, info } from "../notifications/notifications";

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

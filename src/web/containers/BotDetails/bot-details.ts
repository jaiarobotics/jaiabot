// Jaia Imports
import { CommandInfo } from "../../types/commands";
import { MissionState } from "../../utils/protobuf-types";
import { MissionStatus } from "../../types/jaia-system-types";
import { MissionInterface } from "../CommandControl/CommandControl";
import { convertMicrosecondsToSeconds } from "../../shared/Utilities";
import Hub from "../../data/hubs/hub";
import GPS from "../../data/sensors/gps";
import Mission from "../../data/missions/mission";
import Waypoint from "../../data/waypoints/waypoint";

import { point, rhumbDistance, Units } from "@turf/turf";

interface DisableInfo {
    isDisabled: boolean;
    disableMessage: string;
}

/**
 * Provides a class name that corresponds to styles illustrating comms health
 *
 * @param {number} portalStatusAge Time since last communication between Bot and Hub
 * @returns {string} Class name that dictates the style of the status age
 */
export function getStatusAgeClassName(portalStatusAge: number) {
    const healthFailedTimeout = 30;
    const healthDegradedTimeout = 10;
    const statusAgeSeconds = convertMicrosecondsToSeconds(portalStatusAge);

    if (statusAgeSeconds > healthFailedTimeout) {
        return "healthFailed";
    }

    if (statusAgeSeconds > healthDegradedTimeout) {
        return "healthDegraded";
    }

    return "";
}

/**
 * Calculates the distance between a Bot and Hub
 *
 * @param {GPS} botGPS Contains the lat/lon data for distance calculation
 * @param {GPS} hubGPS Contains the lat/lon data for distance calculation
 * @returns {string} Distance between Bot and Hub in meters
 */
export function getDistanceToHub(botGPS: GPS, hubGPS: GPS) {
    if (!(botGPS.getLat() && botGPS.getLon())) {
        return "N/A";
    }

    if (!(hubGPS.getLat() && hubGPS.getLon())) {
        return "N/A";
    }

    const botLocation = point([botGPS.getLat(), botGPS.getLon()]);
    const hubLocation = point([hubGPS.getLat(), hubGPS.getLon()]);
    const options = { units: "meters" as Units };
    return rhumbDistance(botLocation, hubLocation, options).toFixed(1);
}

/**
 * Provides helper text to operators for creating waypoints
 *
 * @param {Mission} mission Determines what message to display based on properties
 * @returns {string} Helper text for adding waypoints
 *
 * @notes Edit mode toggle and related items will not be functional
 * until mission management refactor is complete
 */
export function getWaypontHelperText(mission: Mission) {
    if (!mission || mission.getCanEdit()) {
        return "Click on the map to create waypoints";
    }
    return "Click edit toggle to create waypoint";
}

/**
 * Provides data offload percentage
 *
 * @param {number} botID Used to grab the correct offload data from the Hub
 * @param {Hub} hub Contains the bot offload progress
 * @returns {string} Data offload percentage
 */
export function getBotOffloadPercent(botID: number, hub: Hub) {
    let botOffloadPercentage = "";

    if (botID === hub.getBotOffload()?.bot_id) {
        botOffloadPercentage = " " + hub.getBotOffload().data_offload_percentage + "%";
    }

    return botOffloadPercentage;
}

/**
 * Formats repeat progress text
 *
 * @param {number} repeats Total number of times a mission will play itself back
 * @param {MissionStatus} missionStatus Contains the in progress data of the mission from the Bot
 * @returns {string} "N/A" if repeats not set or "x of y" if mission includes repeats
 */
export function getRepeatProgress(repeats: number, missionStatus: MissionStatus) {
    let repeatProgress = "N/A";

    if (missionStatus?.repeatIndex) {
        repeatProgress = `${missionStatus.repeatIndex + 1} of ${repeats}`;
    }

    return repeatProgress;
}

/**
 * Checks if Bot is logging
 *
 * @param {MissionState} missionState Contains the state of the Bot
 * @returns {boolean} Whether or not the Bot is logging
 */
export function isBotLogging(missionState: MissionState) {
    if (
        missionState == "PRE_DEPLOYMENT__IDLE" ||
        missionState == "PRE_DEPLOYMENT__FAILED" ||
        missionState?.startsWith("POST_DEPLOYMENT__")
    ) {
        return false;
    }

    return true;
}

/**
 * Provides active wapoint number and the Bot's distance to that point
 *
 * @param {MissionStatus} missionStatus Contains the active waypoint and Bot's distance to that waypoint
 * @returns {string, string} Tuple containg the active waypoint and distance to it
 *
 * @notes When Mission Status is reworked to remove Runs from the vocabulary
 * we should add logic to the new Mission Status to make this simpler
 * alleviating need to return a tuple
 */
export function getActiveWptStrings(missionStatus: MissionStatus) {
    let activeWptString = missionStatus.activeGoal ?? "N/A";
    let distToWpt = missionStatus.distanceToActiveGoal ?? "N/A";

    if (activeWptString !== "N/A" && distToWpt === "N/A") {
        distToWpt = "Distance To Goal > 1000";
    } else if (activeWptString !== "N/A" && distToWpt !== "N/A") {
        distToWpt = distToWpt + " m";
    } else if (activeWptString === "N/A" && distToWpt !== "N/A") {
        activeWptString = "Recovery";
        distToWpt = distToWpt + " m";
    }

    return { activeWptString, distToWpt };
}

/**
 * @notes Refactor comming after new mission management implementation
 */
export function runMission(botId: number, mission: MissionInterface) {
    let runs = mission.runs;
    let runId = mission.botsAssignedToRuns[botId];
    let run = runs[runId];

    if (run) {
        if (mission.runIdInEditMode === run.id) {
            mission.runIdInEditMode = "";
        }
        return run.command;
    } else {
        return null;
    }
}

/**
 * @notes Refactor comming with notification management story
 */
export function disableButton(
    command: CommandInfo,
    missionState: MissionState,
    botID?: number,
    downloadQueue?: number[],
) {
    let disableInfo: DisableInfo;

    disableInfo = {
        isDisabled: true,
        disableMessage: "",
    };

    const statesAvailable = command.statesAvailable;
    const statesNotAvailable = command.statesNotAvailable;
    const humanReadableAvailable = command.humanReadableAvailable;
    const humanReadableNotAvailable = command.humanReadableNotAvailable;

    const disableMessage =
        "The command: " + command.commandType + " cannot be sent because the bot";
    const disableState =
        disableMessage +
        " is in the incorrect state." +
        `${humanReadableAvailable !== "" ? "\nAvailable States: " + humanReadableAvailable + "\n" : ""}` +
        `${humanReadableNotAvailable !== "" ? "States Not Available: " + humanReadableNotAvailable + "\n" : ""}`;

    if (statesAvailable) {
        for (let stateAvailable of statesAvailable) {
            if (stateAvailable.test(missionState)) {
                disableInfo.isDisabled = false;
                break;
            }
        }
    }

    if (statesNotAvailable) {
        for (let stateNotAvailable of statesNotAvailable) {
            if (stateNotAvailable.test(missionState)) {
                disableInfo.isDisabled = true;
                break;
            }
        }
    }

    if (disableInfo.isDisabled) {
        disableInfo.disableMessage += disableState;
    }

    if (botID && downloadQueue) {
        const downloadQueueBotIds = downloadQueue;
        if (downloadQueueBotIds.includes(botID)) {
            disableInfo.isDisabled = true;
            disableInfo.disableMessage +=
                disableMessage +
                " currently preparing for data offload. Check the data offload queue panel. \n";
        }
    }
    return disableInfo;
}

/**
 * @notes Refactor comming with notification management story
 */
export function disableClearRunButton(mission: Mission) {
    let disableInfo: DisableInfo;

    disableInfo = {
        isDisabled: false,
        disableMessage: "",
    };

    if (!mission) {
        disableInfo.disableMessage = "Cannot perform this action because there is no run to delete";
        disableInfo.isDisabled = true;
    }

    return disableInfo;
}

/**
 * @notes Refactor comming with notification management story
 */
export function disablePlayButton(
    botID: number,
    mission: Mission,
    command: CommandInfo,
    missionState: MissionState,
    downloadQueue: number[],
) {
    let disableInfo: DisableInfo;

    disableInfo = {
        isDisabled: false,
        disableMessage: "",
    };

    if (!mission) {
        disableInfo.disableMessage +=
            "The command: " +
            command.commandType +
            " cannot be sent because the bot because it does not have a run available\n";
        disableInfo.isDisabled = true;
    }

    if (disableButton(command, missionState).isDisabled) {
        disableInfo.disableMessage += disableButton(command, missionState).disableMessage;
        disableInfo.isDisabled = true;
    }

    const downloadQueueBotIds = downloadQueue;
    if (downloadQueueBotIds.includes(botID)) {
        disableInfo.disableMessage +=
            "The command: " +
            command.commandType +
            " cannot be sent because the bot because it is in the data offload queue\n";
        disableInfo.isDisabled = true;
    }

    return disableInfo;
}
/**
 * @notes Refactor comming with new mission management implementation
 */
export function toggleEditMode(mission: Mission) {
    if (!mission) return;

    const canEdit = mission.getCanEdit();

    if (canEdit) {
        // if toggling off reset all waypoint move status
        const waypoints: Waypoint[] = mission.getWaypoints();
        waypoints.forEach((element) => {
            element.setCanMoveOnMap(false);
        });
    }
    mission.setCanEdit(!canEdit);
}

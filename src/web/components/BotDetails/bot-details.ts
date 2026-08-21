// Jaia Imports
import { MissionState } from "../../types/protobuf-types";
import { MissionStatus } from "../../types/jaia-system-types";
import { convertMicrosecondsToSeconds } from "../../shared/Utilities";

import { missionSet } from "../../data/mission_set/mission-set";
import Hub from "../../data/hubs/hub";
import GPS from "../../data/sensors/gps";

import { point, rhumbDistance, Units } from "@turf/turf";

/**
 * Provides a class name that corresponds to styles illustrating comms health
 *
 * @param {number} portalStatusAge Time since last communication between Bot and Hub (microseconds)
 * @param {boolean} isCommsDropped Whether or not the Bot is currently experiencing dropped comms
 * @returns {string} Class name that dictates the style of the status age
 */
export function getStatusAgeClassName(portalStatusAge: number, isCommsDropped?: boolean) {
    const healthDegradedTimeout = 10;
    const statusAgeSeconds = convertMicrosecondsToSeconds(portalStatusAge);

    if (isCommsDropped) {
        return "health-state-failed";
    }

    if (statusAgeSeconds > healthDegradedTimeout) {
        return "health-state-degraded";
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

    const botLocation = point([botGPS.getLon(), botGPS.getLat()]);
    const hubLocation = point([hubGPS.getLon(), hubGPS.getLat()]);
    const options = { units: "meters" as Units };
    return rhumbDistance(botLocation, hubLocation, options).toFixed(1);
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
        const data_offload_percentage = hub.getBotOffload().data_offload_percentage;
        if (data_offload_percentage && data_offload_percentage !== 100) {
            botOffloadPercentage = " " + data_offload_percentage + "%";
        }
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
 * Constructs a string to display the Bot's distance from a target waypoint
 *
 * @param {MissionStatus} missionStatus Contains the active waypoint and distance to that waypoint
 * @returns {string} distance to active waypoint or N/A
 */
export function getDistToWaypoint(missionStatus: MissionStatus) {
    if (!missionStatus.targetWaypoint) {
        return "N/A";
    }
    if (missionStatus.distanceToTargetWaypoint) {
        return missionStatus.distanceToTargetWaypoint + " m";
    }
    return "Distance To Goal > 1000";
}

/**
 * Constructs a string to display the time left in the Bot's constant heading task
 *
 * @param {MissionStatus} missionStatus Contains the time remaining in the constant heading task
 * @returns {string} Time remaining in seconds or N/A
 */
export function getConstantHeadingTimeRemaining(missionStatus: MissionStatus) {
    if (missionStatus.constantHeadingTimeRemaining === undefined) {
        return "N/A";
    }
    return missionStatus.constantHeadingTimeRemaining + " s";
}

/**
 * Loops through the ghost missions to check if a Bot is carrying out a mission
 *
 * @param {number} botID Bot of interest
 * @returns {Mission} Mission the Bot is currently running even if deleted from user interface
 */
export function searchGhostMissions(botID: number) {
    for (const ghostMission of missionSet.getGhostMissions().values()) {
        if (ghostMission.getGhostParameters().botID === botID) {
            return ghostMission;
        }
    }
}

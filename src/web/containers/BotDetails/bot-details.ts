// Jaia Imports
import { MissionState } from "../../utils/protobuf-types";
import { MissionStatus } from "../../types/jaia-system-types";
import { convertMicrosecondsToSeconds } from "../../shared/Utilities";

import { missions } from "../../data/missions/missions";
import Hub from "../../data/hubs/hub";
import GPS from "../../data/sensors/gps";
import Mission from "../../data/missions/mission";

import { point, rhumbDistance, Units } from "@turf/turf";

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
    if (!mission || missions.getMissionIDInEditMode() === mission.getMissionID()) {
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
 * Constructs a string to display the Bot's distance from a target waypoint
 *
 * @param {MissionStatus} missionStatus Contains the active waypoint and distance to that waypoint
 * @returns {string} distance to active waypoint or N/A
 */
export function getDistToWaypoint(missionStatus: MissionStatus) {
    if (!missionStatus.activeGoal) {
        return "N/A";
    }
    if (missionStatus.distanceToActiveGoal) {
        return missionStatus.distanceToActiveGoal + " m";
    }
    return "Distance To Goal > 1000";
}

import { bots } from "../data/bots/bots";
import { hubs } from "../data/hubs/hubs";
import { jaiaGlobal } from "../data/jaia_global/jaia-global";
import { taskPackets } from "../data/task_packets/task-packets";
import { missionSet } from "../data/mission_set/mission-set";
import { missionsManager } from "../data/missions_manager/missions-manager";
import {
    batteryPredictions,
    MissionBatteryStatus,
} from "../data/battery_predictions/battery-predictions";
import {
    fetchBatteryPrediction,
    isBotTypeSupported,
} from "../data/battery_predictions/battery-prediction-calculator";
import { PortalBotStatus, PortalHubStatus } from "../shared/PortalStatus";
import { botLayer } from "../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../openlayers/layers/vector/hub-layer";
import { ghostMissionLayer, missionLayer } from "../openlayers/layers/vector/mission-layer";
import { diveLayer } from "../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../openlayers/layers/vector/drift-layer";
import { contourLayer } from "../openlayers/layers/vector/contour-layer";
import { hubCommsLayer } from "../openlayers/layers/vector/hub-comms-layer";
import { excludedTaskPacketsLayer } from "../openlayers/layers/vector/excluded-task-packets-layer";
import { Metadata, Version } from "../types/protobuf-types";
import SoundEffects from "../style/audio/sound-effects";
import { UNASSIGNED_ID } from "../utils/constants";

const MAX_REQUEST_TIME = 10000; // ms;
const VERSION_LENGTH = 3;

const CONNECTION_WARNING = "connection-warning";
const CONGESTION_WARNING = "congestion-warning";
const HUB_CONNECTION_ERROR = "Connection Dropped To HUB";

const STATUS_URL = "/jaia/v0/status";
const TASK_PACKET_URL = "/jaia/v0/task-packets";
const TASK_PACKET_VERSION_URL = "/jaia/v0/task-packets-version";
const METADATA_URL = "/jaia/v0/metadata";
const GITHUB_URL = "https://api.github.com/repos/jaiarobotics/jaiabot/releases/latest";

let statusRequestInFlight = false;
let taskPacketRequestInFlight = false;
let metadataRequestInFlight = false;
let batteryPredictionRequestInFlight = false;

let statusRequestStartTime = new Date().getTime();

/**
 * Hits the status endpoint and updates the data model and openlayers
 * with information from the response
 *
 * @returns {void}
 */
export async function pollStatus() {
    if (statusRequestInFlight) {
        const now = new Date().getTime();
        const duration = now - statusRequestStartTime;
        if (duration > MAX_REQUEST_TIME) {
            updateWarning(CONGESTION_WARNING, true);
        }
        return;
    }
    try {
        statusRequestInFlight = true;
        statusRequestStartTime = new Date().getTime();
        const response = await fetch(STATUS_URL);
        if (!response.ok) {
            console.error(`Response status: ${response.status}`);
        } else {
            const json = await response.json();
            updateBots(json.bots);
            updateHubs(json.hubs);
            updateJaiaGlobal(json.controllingClientId);
            updateOpenLayers();
            if (json.messages.error && json.messages.error === HUB_CONNECTION_ERROR) {
                updateWarning(CONNECTION_WARNING, true);
            } else {
                updateWarning(CONNECTION_WARNING, false);
            }
        }
    } catch (error) {
        updateWarning(CONNECTION_WARNING, true);
        console.error(error);
    }
    const endTime = new Date().getTime();
    const duration = endTime - statusRequestStartTime;
    if (duration > MAX_REQUEST_TIME) {
        updateWarning(CONGESTION_WARNING, true);
    } else {
        updateWarning(CONGESTION_WARNING, false);
    }
    statusRequestInFlight = false;
}

/**
 * Hits the task packets endpoint and updates the data model and openlayers
 * with information from the response
 *
 * @returns {void}
 */
export async function pollTaskPackets() {
    if (taskPacketRequestInFlight) {
        return;
    }
    try {
        taskPacketRequestInFlight = true;
        const versionRes = await fetch(TASK_PACKET_VERSION_URL);
        if (!versionRes.ok) {
            console.error(`Task packet response status: ${versionRes.status}`);
        } else {
            const version = await versionRes.json();
            if (version !== taskPackets.getVersion()) {
                const taskPacketRes = await fetch(TASK_PACKET_URL);
                const json = await taskPacketRes.json();
                taskPackets.setIncludedTaskPackets(json.result.included);
                taskPackets.setExcludedTaskPackets(json.result.excluded);
                updateTaskLayers();
                taskPackets.setVersion(version);
            }
        }
    } catch (error) {
        console.error(error);
    }
    taskPacketRequestInFlight = false;
}

/**
 * Hits the metadata endpoint and updates the data model
 * with information from the response
 *
 * @returns {void}
 */
export async function pollMetadata() {
    if (metadataRequestInFlight) {
        return;
    }
    try {
        metadataRequestInFlight = true;
        const res = await fetch(METADATA_URL);
        if (!res.ok) {
            console.error(`Metadata response status: ${res.status}`);
        } else {
            const metadata: Metadata = await res.json();
            const isUpgradeAvailable = compareVersions(
                metadata.jaiabot_version,
                jaiaGlobal.getGitHubVersion(),
            );
            jaiaGlobal.setMetadata(metadata);
            jaiaGlobal.setIsUpgradeAvailable(isUpgradeAvailable);
        }
    } catch (error) {
        console.error(error);
    }
    metadataRequestInFlight = false;
}

/**
 * Recomputes the battery prediction for every mission with an assigned Bot and
 * updates the client-side data model with the results
 *
 * @returns {void}
 */
export async function pollBatteryPredictions() {
    if (batteryPredictionRequestInFlight) {
        return;
    }
    try {
        batteryPredictionRequestInFlight = true;
        await updateBatteryPredictions();
    } catch (error) {
        console.error(error);
    }
    batteryPredictionRequestInFlight = false;
}

/**
 * Hits the jaiabot GitHub repo for the latest version and
 * updates the data model with information from the response
 *
 * @returns {void}
 */
export async function pollGitHub() {
    if (!jaiaGlobal.getIsConnectedToInternet()) {
        return;
    }

    // We already retrieved the version from GitHub
    if (jaiaGlobal.getGitHubVersion().major !== "") {
        return;
    }

    try {
        const res = await fetch(GITHUB_URL);
        if (!res.ok) {
            console.error(`GitHub response status: ${res.status}`);
        } else {
            const json = await res.json();
            const gitHubVersion = deconstructTagName(json.tag_name);
            jaiaGlobal.setGitHubVersion(gitHubVersion);
        }
    } catch (error) {
        console.error(error);
    }
}

/**
 * Pings Google to check for Internet connectivity
 *
 * @returns {void}
 */
export async function pollInternet() {
    try {
        await fetch("https://www.google.com", {
            mode: "no-cors",
            cache: "no-store",
            signal: AbortSignal.timeout(1000),
        });
        jaiaGlobal.setIsConnectedToInternet(true);
    } catch {
        jaiaGlobal.setIsConnectedToInternet(false);
    }
}

/**
 * Recomputes the battery prediction for every mission with an assigned Bot and
 * moves the results into the client-side data model
 *
 * @returns {void}
 */
async function updateBatteryPredictions() {
    const statuses = new Map<number, MissionBatteryStatus>();

    await Promise.all(
        Array.from(missionSet.getMissions()).map(async ([missionID, mission]) => {
            const botID = missionsManager.getBotID(missionID);
            if (botID === UNASSIGNED_ID) return;
            const bot = bots.getBot(botID);
            if (!bot) return;

            const [prediction, isSupported] = await Promise.all([
                fetchBatteryPrediction(mission, bot),
                isBotTypeSupported(bot.getBotType()),
            ]);
            statuses.set(missionID, { prediction, isUnsupportedBotType: !isSupported });
        }),
    );

    batteryPredictions.setStatuses(statuses);
}

/**
 * Moves Bot data from the server to the client-side data model
 *
 * @param {PortalBotStatus} botStatuses Bot data from the server
 * @returns {void}
 */
function updateBots(botStatuses: { [botID: string]: PortalBotStatus }) {
    const botIDs = Object.keys(botStatuses);
    for (let botID of botIDs) {
        const numericBotID = Number(botID);
        const wasCommsDropped = bots.getBot(numericBotID)?.isCommsDropped() ?? false;
        bots.setBot(botStatuses[botID]);
        botStatuses[botID].isDisconnected = bots.getBot(numericBotID)?.isCommsDropped() ?? false;
        handleBotSoundEffects(wasCommsDropped, botStatuses[botID].isDisconnected);
    }
    bots.setTick(bots.getTick() + 1);
}

/**
 * Moves Hub data from the server to the client-side data model
 *
 * @param {PortalHubStatus} hubStatuses Hub data from the server
 * @returns {void}
 */
function updateHubs(hubStatuses: { [hubId: string]: PortalHubStatus }) {
    const hubIDs = Object.keys(hubStatuses);
    for (let hubID of hubIDs) {
        hubs.setHub(hubStatuses[hubID]);
    }
}

/**
 * Move the controlling client ID from the server to the client-side data model
 *
 * @param {string} controllingClientID ID from the server
 * @returns {void}
 */
function updateJaiaGlobal(controllingClientID: string) {
    jaiaGlobal.setControllingClientID(controllingClientID);
}

/**
 * Makes calls to update the positions of the Bots and Hub on the map.
 * For the first Bot loaded with a GPS fix, a call is made to zoom to that Bot.
 *
 * @returns {void}
 */
function updateOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
    ghostMissionLayer.updateFeatures();
    hubCommsLayer.updateFeatures();
}

/**
 * Makes calls to update the task layers with the latest task packet data
 *
 * @returns {void}
 */
function updateTaskLayers() {
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    contourLayer.updateFeatures();
    excludedTaskPacketsLayer.updateFeatures();
}

/**
 * Displays a warning to the operator when the connection to the Hub drops
 *
 * @param {boolean} isDisconnected State of client to server connection
 * @returns {void}
 */
function updateWarning(id: string, isDisconnected: boolean) {
    const connectionWarning = document.getElementById(id);
    if (!connectionWarning) {
        return;
    }

    if (isDisconnected) {
        connectionWarning.style.visibility = "visible";
    } else {
        connectionWarning.style.visibility = "hidden";
    }
}

/**
 * Plays disconnect and reconnect sounds based on Bot's comms state transitions
 *
 * @param {boolean} wasCommsDropped Previous comms dropped state
 * @param {boolean} isCommsDropped Current comms dropped state
 * @returns {void}
 */
function handleBotSoundEffects(wasCommsDropped: boolean, isCommsDropped: boolean) {
    // Transition from connected to disconnected
    if (isCommsDropped && !wasCommsDropped) {
        SoundEffects.botDisconnect.play();
    }

    // Transition from disconnected to connected
    if (!isCommsDropped && wasCommsDropped) {
        SoundEffects.botReconnect.play();
    }
}

/**
 * Converts the tag from a string to a Version object
 *
 * @param {string} tagName Tag from GitHub (ex: 2.6.0)
 * @returns {Version} Tag broken into major, minor, and patch
 */
function deconstructTagName(tagName: string) {
    const gitHubVersion: Version = {
        major: "",
        minor: "",
        patch: "",
    };
    if (tagName) {
        const version = tagName.split(".");
        if (version.length === VERSION_LENGTH) {
            gitHubVersion.major = version[0];
            gitHubVersion.minor = version[1];
            gitHubVersion.patch = version[2];
        }
    }
    return gitHubVersion;
}

/**
 * Determines if the GitHub tag is newer than the version on the Hub
 *
 * @param {Version} currentVersion Version fetched from Hub
 * @param {Version} gitHubVersion Version fetched from jaiabot repo
 * @returns {boolean} True if there is a new version, False otherwise
 */
function compareVersions(currentVersion: Version, gitHubVersion: Version) {
    if (!currentVersion) {
        return false;
    }

    if (gitHubVersion.major === "") {
        return false;
    }

    if (parseInt(gitHubVersion.major) > parseInt(currentVersion.major)) {
        return true;
    }

    if (parseInt(gitHubVersion.minor) > parseInt(currentVersion.minor)) {
        return true;
    }

    if (parseInt(gitHubVersion.patch) > parseInt(currentVersion.patch[0])) {
        return true;
    }

    return false;
}

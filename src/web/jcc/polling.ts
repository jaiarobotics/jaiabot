import { bots } from "../data/bots/bots";
import { hubs } from "../data/hubs/hubs";
import { jaiaGlobal } from "../data/jaia_global/jaia-global";
import { taskPackets } from "../data/task_packets/task-packets";
import { taskPacketFilter } from "../data/task_packets/task-packet-filter";
import {
    APIResponse_Statuses,
    LinkStatusAge,
    PortalBotStatus,
    PortalHubStatus,
} from "@proto/jaiabot/messages/rest_api";
import { BotStatus } from "@proto/jaiabot/messages/jaia_dccl";
import { Engineering } from "@proto/jaiabot/messages/engineering";
import { botLayer } from "../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../openlayers/layers/vector/hub-layer";
import { ghostMissionLayer, missionLayer } from "../openlayers/layers/vector/mission-layer";
import { diveLayer } from "../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../openlayers/layers/vector/drift-layer";
import { contourLayer } from "../openlayers/layers/vector/contour-layer";
import { hubCommsLayer } from "../openlayers/layers/vector/hub-comms-layer";
import { excludedTaskPacketsLayer } from "../openlayers/layers/vector/excluded-task-packets-layer";
import { DeviceMetadata, DeviceMetadata_Version } from "@proto/jaiabot/messages/metadata";
import SoundEffects from "../style/audio/sound-effects";
import { jaia_rest_api } from "../utils/jaia-rest-api";

const MAX_REQUEST_TIME = 10000; // ms;
const VERSION_LENGTH = 3;

const CONNECTION_WARNING = "connection-warning";
const CONGESTION_WARNING = "congestion-warning";

const GITHUB_URL = "https://api.github.com/repos/jaiarobotics/jaiabot/releases/latest";

let statusRequestInFlight = false;
let taskPacketRequestInFlight = false;
let metadataRequestInFlight = false;

// Date window last fetched; lets the poll force a refetch when the filter window changes
let lastFetchedWindowKey = "";

// Increments per task packet fetch so a slower, superseded response
// can't overwrite newer task packets in the data model.
let latestTaskPacketRequest = 0;

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

        const [rest_response, engineering_response] = await Promise.all([
            jaia_rest_api.request({
                target: {
                    all: true,
                },
                status: true,
            }),
            jaia_rest_api.request({
                target: {
                    all: true,
                },
                engineering_status: true,
            }),
        ]);

        const status = rest_response.status;

        if (status == null) {
            throw new Error("Status response is null");
        }

        updateBots(
            toPortalBotStatuses(status, engineering_response.engineering_status?.bots ?? []),
        );
        updateHubs(toPortalHubStatuses(status));
        updateJaiaGlobal(status.controlling_client_id ?? null);
        updateOpenLayers();
        updateWarning(CONNECTION_WARNING, false);
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

        const task_packets_version_response = await jaia_rest_api.request({
            target: {
                all: true,
            },
            task_packets_version: true,
        });

        const version = task_packets_version_response.task_packets_version?.version ?? 0;

        // Refetch when the filter window changes, even if the server version is unchanged.
        const forceFetch = getTaskPacketWindowKey() !== lastFetchedWindowKey;
        // A superseded fetch records nothing, so the next poll fetches again.
        if (
            (forceFetch || version !== taskPackets.getVersion()) &&
            (await refreshTaskPacketsForWindow())
        ) {
            taskPackets.setVersion(version);
        }
    } catch (error) {
        console.error(error);
    }
    taskPacketRequestInFlight = false;
}

/**
 * Returns a key identifying the requested task packet window.
 *
 * @returns {string} Window identity key
 */
function getTaskPacketWindowKey() {
    return `${taskPacketFilter.getStartDate().getTime()}|${taskPacketFilter.getEndDate().getTime()}`;
}

/**
 * Fetches task packets for the current window and loads them into the data model, unless a newer
 * fetch or filter search has started since. Every refetch of the task packets goes through here.
 * Records the window it applied so the poll doesn't fetch the same window again.
 *
 * @returns {Promise<boolean>} True if the response was applied, false if it was superseded
 */
export async function refreshTaskPacketsForWindow() {
    const requestID = ++latestTaskPacketRequest;
    // Taken before the fetch reads the filter, so the key matches the window fetched.
    const windowKey = getTaskPacketWindowKey();
    const { included, excluded } = await fetchTaskPacketsForWindow();
    if (requestID !== latestTaskPacketRequest) {
        return false;
    }
    taskPackets.setIncludedTaskPackets(included);
    taskPackets.setExcludedTaskPackets(excluded);
    lastFetchedWindowKey = windowKey;
    updateTaskLayers();
    return true;
}

/**
 * Fetches task packets for the filter's window.
 *
 * @returns {Promise<{ included: TaskPacket[]; excluded: TaskPacket[] }>} Task packets in the window
 *
 * @notes
 * JCC always sends the window rather than relying on the server's default.
 */
async function fetchTaskPacketsForWindow() {
    const query = (inclusion: { included_only: boolean } | { excluded_only: boolean }) =>
        jaia_rest_api
            .request({
                target: {
                    all: true,
                },
                task_packets: {
                    start_time: String(taskPacketFilter.getStartDate().getTime() * 1000),
                    end_time: String(taskPacketFilter.getEndDate().getTime() * 1000),
                    ...inclusion,
                },
            })
            .then((response) => response.task_packets?.packets ?? []);

    const [included, excluded] = await Promise.all([
        query({ included_only: true }),
        query({ excluded_only: true }),
    ]);
    return { included, excluded };
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

        const metadata_response = await jaia_rest_api.request({
            target: {
                all: true,
            },
            metadata: true,
        });

        // Get metadata for the first hub
        const metadata = metadata_response.metadata?.hubs?.[0];

        const isUpgradeAvailable = compareVersions(
            metadata?.jaiabot_version,
            jaiaGlobal.getGitHubVersion(),
        );
        jaiaGlobal.setMetadata(metadata);
        jaiaGlobal.setIsUpgradeAvailable(isUpgradeAvailable);
    } catch (error) {
        console.error(error);
    }
    metadataRequestInFlight = false;
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
 * Combines the per-bot data in a status response into PortalBotStatus objects.
 * Ages are measured against the hub's clock so they are independent of the client's clock.
 *
 * @param {APIResponse_Statuses} status Status response from the hub
 * @param {Engineering[]} engineeringStatuses Engineering status response from the hub
 * @returns {PortalBotStatus[]} Status of each bot
 */
function toPortalBotStatuses(
    status: APIResponse_Statuses,
    engineeringStatuses: Engineering[],
): PortalBotStatus[] {
    const hubTime = Number(status.time ?? 0);

    return (status.bots ?? []).map((botStatus) => ({
        bot_status: botStatus,
        active_mission_plan: status.active_mission_plans?.find(
            (plan) => plan.bot_id === botStatus.bot_id,
        )?.mission_plan,
        engineering: engineeringStatuses.find(
            (engineering) => engineering.bot_id === botStatus.bot_id,
        ),
        active_link_status_age: getActiveLinkStatusAges(botStatus, hubTime),
        status_age: hubTime - Number(botStatus.received_time ?? 0),
    }));
}

/**
 * Wraps the hub statuses in a status response into PortalHubStatus objects.
 *
 * @param {APIResponse_Statuses} status Status response from the hub
 * @returns {PortalHubStatus[]} Status of each hub
 */
function toPortalHubStatuses(status: APIResponse_Statuses): PortalHubStatus[] {
    const hubTime = Number(status.time ?? 0);

    return (status.hubs ?? []).map((hubStatus) => ({
        hub_status: hubStatus,
        status_age: hubTime - Number(hubStatus.received_time ?? 0),
    }));
}

/**
 * Computes how long ago each active link last delivered a status, in real-time microseconds
 *
 * @param {BotStatus} botStatus Status containing the per-link last received times
 * @param {number} hubTime Hub's wall clock time in microseconds
 * @returns {LinkStatusAge[]} Age of each active link
 */
function getActiveLinkStatusAges(botStatus: BotStatus, hubTime: number): LinkStatusAge[] {
    // last_received_time is stamped with the hub's (possibly warped) simulation clock
    const metadata = jaiaGlobal.getMetadata();
    const warpFactor = metadata?.simulation_warp || 1;
    const referenceTime = Number(metadata?.simulation_reference_time ?? 0);
    const hubSimTime = referenceTime + (hubTime - referenceTime) * warpFactor;

    return (botStatus.active_links ?? [])
        .filter((activeLink) => activeLink.last_received_time !== undefined)
        .map((activeLink) => ({
            link: activeLink.link,
            age: Math.trunc((hubSimTime - Number(activeLink.last_received_time)) / warpFactor),
        }));
}

/**
 * Moves Bot data from the server to the client-side data model
 *
 * @param {PortalBotStatus} botStatuses Bot data from the server
 * @returns {void}
 */
function updateBots(botStatuses: PortalBotStatus[]) {
    for (let botStatus of botStatuses) {
        const numericBotID = botStatus.bot_status?.bot_id ?? -1;
        const wasCommsDropped = bots.getBot(numericBotID)?.isCommsDropped() ?? false;
        bots.setBot(botStatus);
        botStatus.is_disconnected = bots.getBot(numericBotID)?.isCommsDropped() ?? false;
        handleBotSoundEffects(wasCommsDropped, botStatus.is_disconnected);
    }
    bots.setTick(bots.getTick() + 1);
}

/**
 * Moves Hub data from the server to the client-side data model
 *
 * @param {PortalHubStatus} hubStatuses Hub data from the server
 * @returns {void}
 */
function updateHubs(hubStatuses: PortalHubStatus[]) {
    for (let hubStatus of hubStatuses) {
        hubs.setHub(hubStatus);
    }
}

/**
 * Move the controlling client ID from the server to the client-side data model
 *
 * @param {string | null} controllingClientID ID from the server, or null if no client has taken control
 * @returns {void}
 */
function updateJaiaGlobal(controllingClientID: string | null) {
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
 * @returns {DeviceMetadata_Version} Tag broken into major, minor, and patch
 */
function deconstructTagName(tagName: string) {
    const gitHubVersion: DeviceMetadata_Version = {
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
 * @param {DeviceMetadata_Version} currentVersion Version fetched from Hub
 * @param {DeviceMetadata_Version} gitHubVersion Version fetched from jaiabot repo
 * @returns {boolean} True if there is a new version, False otherwise
 */
function compareVersions(
    currentVersion: DeviceMetadata_Version | undefined,
    gitHubVersion: DeviceMetadata_Version,
) {
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

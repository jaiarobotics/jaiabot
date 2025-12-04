import * as ReactDOM from "react-dom/client";
import App from "./App";

import { bots } from "../data/bots/bots";
import { hubs } from "../data/hubs/hubs";
import { taskPackets } from "../data/task_packets/task-packets";
import { PortalBotStatus, PortalHubStatus } from "../shared/PortalStatus";
import { botLayer } from "../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../openlayers/layers/vector/hub-layer";
import { missionLayer } from "../openlayers/layers/vector/mission-layer";
import { diveLayer } from "../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../openlayers/layers/vector/drift-layer";
import { contourLayer } from "../openlayers/layers/vector/contour-layer";
import { hubCommsLayer } from "../openlayers/layers/vector/hub-comms-layer";
import { excludedTaskPacketsLayer } from "../openlayers/layers/vector/excluded-task-packets-layer";
import { DATA_MODEL_POLL_TIME, TASK_PACKET_POLL_TIME } from "../utils/constants";

// Sample status messages twice as fast as produced by Bots and Hubs to reduce potential data age issues
const STATUS_URL = "/jaia/v0/status";
const TASK_PACKET_URL = "/jaia/v0/task-packets";
const TASK_PACKET_VERSION_URL = "/jaia/v0/task-packets-version";
const HUB_CONNECTION_ERROR = "Connection Dropped To HUB";

let statusRequestInFlight = false;
let taskPacketRequestInFlight = false;

const statusInterval = setInterval(async () => {
    if (statusRequestInFlight) {
        return;
    }
    try {
        statusRequestInFlight = true;
        const response = await fetch(STATUS_URL);
        if (!response.ok) {
            console.error(`Response status: ${response.status}`);
        } else {
            const json = await response.json();
            updateBots(json.bots);
            updateHubs(json.hubs);
            updateOpenLayers();
            if (json.messages.error && json.messages.error === HUB_CONNECTION_ERROR) {
                updateDisconnectedWarning(true);
            } else {
                updateDisconnectedWarning(false);
            }
        }
    } catch (error) {
        updateDisconnectedWarning(true);
        console.error(error);
    }
    statusRequestInFlight = false;
}, DATA_MODEL_POLL_TIME);

const taskPacketInterval = setInterval(async () => {
    if (taskPacketRequestInFlight) {
        return;
    }
    try {
        taskPacketRequestInFlight = true;
        const versionRes = await fetch(TASK_PACKET_VERSION_URL);
        if (!versionRes.ok) {
            console.error(`Response status: ${versionRes.status}`);
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
}, TASK_PACKET_POLL_TIME);

/**
 * Moves Bot data from the server to the client-side data model
 *
 * @param {PortalBotStatus} botStatuses Bot data from the server
 * @returns {void}
 */
function updateBots(botStatuses: { [botID: string]: PortalBotStatus }) {
    const botIDs = Object.keys(botStatuses);
    for (let botID of botIDs) {
        bots.setBot(botStatuses[botID]);
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
 * Makes calls to update the positions of the Bots and Hub on the map.
 * For the first Bot loaded with a GPS fix, a call is made to zoom to that Bot.
 *
 * @returns {void}
 */
function updateOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
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
function updateDisconnectedWarning(isDisconnected: boolean) {
    const connectionWarning = document.getElementById("connection-warning");
    if (isDisconnected) {
        connectionWarning.style.visibility = "visible";
    } else {
        connectionWarning.style.visibility = "hidden";
    }
}

let element = document.getElementById("root");
const root = ReactDOM.createRoot(element);
root.render(<App />);

module.hot.accept();

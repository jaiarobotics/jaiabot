import * as ReactDOM from "react-dom/client";
import App from "./App";

import { fromLonLat } from "ol/proj";

import { bots } from "../data/bots/bots";
import { hubs } from "../data/hubs/hubs";
import { taskPackets } from "../data/task_packets/task-packets";
import { PortalBotStatus, PortalHubStatus } from "../shared/PortalStatus";
import { map } from "../openlayers/maps/map";
import { botLayer } from "../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../openlayers/layers/vector/hub-layer";
import { missionLayer } from "../openlayers/layers/vector/mission-layer";
import { diveLayer } from "../openlayers/layers/vector/dive-layer";
import { hubCommsLayer } from "../openlayers/layers/vector/hub-comms-layer";
import {
    DATA_MODEL_POLL_TIME,
    INITAL_ZOOM_DURATION,
    INITIAL_ZOOM,
    TASK_PACKET_POLL_TIME,
} from "../utils/constants";

// Sample status messages twice as fast as produced by Bots and Hubs to reduce potential data age issues
const statusURL = "http://localhost:40001/jaia/v0/status";
const taskPacketURL = "http://localhost:40001/jaia/v0/task-packets";

let isFirstBot = true;

const statusInterval = setInterval(async () => {
    try {
        const response = await fetch(statusURL);
        if (!response.ok) {
            console.error(`Response status: ${response.status}`);
        } else {
            const json = await response.json();
            updateBots(json.bots);
            updateHubs(json.hubs);
            updateOpenLayers();
        }
    } catch (error) {
        console.error(error);
    }
}, DATA_MODEL_POLL_TIME);

const taskPacketInterval = setInterval(async () => {
    try {
        const response = await fetch(taskPacketURL);
        if (!response.ok) {
            console.error(`Response status: ${response.status}`);
        } else {
            const json = await response.json();
            taskPackets.setTaskPackets(json.result.included);
            updateTaskLayers();
        }
    } catch (error) {
        console.error(error);
    }
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

    if (isFirstBot && bots.getBots().size > 0) {
        zoomToFirstBot();
    }
}

/**
 * Makes calls to update the task layers with the latest task packet data
 *
 * @returns {void}
 */
function updateTaskLayers() {
    diveLayer.updateFeatures();
}

/**
 * Finds the first Bot with a GPS fix and zooms to that location
 *
 * @returns {void}
 */
function zoomToFirstBot() {
    for (const [botID, bot] of bots.getBots().entries()) {
        if (bot.getLocation()?.lat && bot.getLocation()?.lon) {
            const location = fromLonLat([bot.getLocation().lon, bot.getLocation().lat]);
            map.getView().animate({
                center: location,
                duration: INITAL_ZOOM_DURATION,
                zoom: INITIAL_ZOOM,
            });
            isFirstBot = false;
            break;
        }
    }
}

let element = document.getElementById("root");
const root = ReactDOM.createRoot(element);
root.render(<App />);

module.hot.accept();

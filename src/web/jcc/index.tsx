import * as ReactDOM from "react-dom/client";
import App from "./App";

import { fromLonLat } from "ol/proj";

import { bots } from "../data/bots/bots";
import { hubs } from "../data/hubs/hubs";
import { PortalBotStatus, PortalHubStatus } from "../shared/PortalStatus";
import { map } from "../openlayers/maps/map";
import { botLayer } from "../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../openlayers/layers/vector/hub-layer";
import { DATA_MODEL_POLL_TIME, INITAL_ZOOM_DURATION, INITIAL_ZOOM } from "../utils/constants";

// Sample status messages twice as fast as produced by Bots and Hubs to reduce potential data age issues
const statusIntervalTimeout = DATA_MODEL_POLL_TIME; // ms
const statusURL = "http://localhost:40001/jaia/v0/status";

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
}, statusIntervalTimeout);

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

    if (isFirstBot && bots.getBots().size > 0) {
        zoomToFirstBot();
    }
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

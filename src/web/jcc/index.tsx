import React from "react";
import * as ReactDOM from "react-dom/client";
import App from "./App";

import { bots } from "../data/bots/bots";
import { hubs } from "../data/hubs/hubs";
import { PortalBotStatus, PortalHubStatus } from "../shared/PortalStatus";

// Sample status messages twice as fast as produced by Bots and Hubs to reduce potential data age issues
const statusIntervalTimeout = 500; // ms
const statusURL = "http://localhost:40001/jaia/v0/status";

const statusInterval = setInterval(async () => {
    try {
        const response = await fetch(statusURL);
        if (!response.ok) {
            console.error(`Response status: ${response.status}`);
        } else {
            const json = await response.json();
            updateBots(json.bots);
            updateHubs(json.hubs);
        }
    } catch (error) {
        console.error(error);
    }
}, statusIntervalTimeout);

function updateBots(botStatuses: { [botID: string]: PortalBotStatus }) {
    const botIDs = Object.keys(botStatuses);
    for (let botID of botIDs) {
        if (bots.isNewBot(Number(botID))) {
            bots.addBot(botStatuses[botID]);
        } else {
            bots.updateBot(botStatuses[botID]);
        }
    }
}

function updateHubs(hubStatuses: { [hubId: string]: PortalHubStatus }) {
    const hubIDs = Object.keys(hubStatuses);
    for (let hubID of hubIDs) {
        if (hubs.isNewHub(Number(hubID))) {
            hubs.addHub(hubStatuses[hubID]);
        } else {
            hubs.updateHub(hubStatuses[hubID]);
        }
    }
}

let element = document.getElementById("root");
const root = ReactDOM.createRoot(element);
root.render(<App />);

module.hot.accept();

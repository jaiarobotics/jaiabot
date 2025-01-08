const bots = require("../bots/bots");
const hubs = require("../hubs/hubs");

const statusIntervalTimeout = 1000;
const statusURL = "http://localhost:40001/jaia/v0/status";
const hubStatusURL = "http://localhost:40001/jaia/v0/status-hubs";

const botStatusInterval = setInterval(async () => {
    try {
        const response = await fetch(statusURL);
        if (!response.ok) {
            console.error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        updateBots(json.bots);
    } catch (error) {
        console.error(error);
    }
}, statusIntervalTimeout);

const hubStatusInterval = setInterval(async () => {
    try {
        const response = await fetch(hubStatusURL);
        if (!response.ok) {
            console.error(`Response status: ${response.status}`);
        }

        const json = await response.json();
        updateHubs(json);
    } catch (error) {
        console.error(error);
    }
}, statusIntervalTimeout);

function updateBots(botStatuses: { [botID: string]: any }) {
    const botIDs = Object.keys(botStatuses);
    for (let botID of botIDs) {
        if (bots.isNewBot(Number(botID))) {
            bots.addBot(botStatuses[botID]);
        } else {
            bots.updateBot(botStatuses[botID]);
        }
    }
}

function updateHubs(hubStatuses: { [hubId: string]: any }) {
    const hubIDs = Object.keys(hubStatuses);
    for (let hubID of hubIDs) {
        if (hubs.isNewHub(Number(hubID))) {
            hubs.addHub(hubStatuses[hubID]);
        } else {
            hubs.updateHub(hubStatuses[hubID]);
        }
    }
}

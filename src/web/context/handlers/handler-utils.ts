import { botLayer } from "../../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../../openlayers/layers/vector/hub-layer";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { rallyLayer } from "../../openlayers/layers/vector/rally-layer";
import { diveLayer } from "../../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../../openlayers/layers/vector/drift-layer";
import { contourLayer } from "../../openlayers/layers/vector/contour-layer";
import { excludedTaskPacketsLayer } from "../../openlayers/layers/vector/excluded-task-packets-layer";
import { bots } from "../../data/bots/bots";
import { missionsManager } from "../../data/missions_manager/missions-manager";

/**
 * Repaints the map layers using the latest data
 *
 * @returns {void}
 */
export function syncOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
    rallyLayer.updateFeatures();
}

export function syncTaskLayers() {
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    contourLayer.updateFeatures();
    excludedTaskPacketsLayer.updateFeatures();
}

export function isActiveMission(missionID: number) {
    const botID = missionsManager.getBotID(missionID);
    const bot = bots.getBot(botID);
    if (bot && bot.getMissionStatus().targetWaypoint) {
        return true;
    }
    return false;
}

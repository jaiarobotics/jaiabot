import { botLayer } from "../../openlayers/layers/vector/bot-layer";
import { hubLayer } from "../../openlayers/layers/vector/hub-layer";
import { ghostMissionLayer, missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { rallyLayer } from "../../openlayers/layers/vector/rally-layer";
import { diveLayer } from "../../openlayers/layers/vector/dive-layer";
import { driftLayer } from "../../openlayers/layers/vector/drift-layer";
import { contourLayer } from "../../openlayers/layers/vector/contour-layer";
import { excludedTaskPacketsLayer } from "../../openlayers/layers/vector/excluded-task-packets-layer";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { bots } from "../../data/bots/bots";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { missionSet } from "../../data/mission_set/mission-set";

/**
 * Repaints the map layers using the latest data
 *
 * @returns {void}
 */
export function syncOpenLayers() {
    botLayer.updateFeatures();
    hubLayer.updateFeatures();
    missionLayer.updateFeatures();
    ghostMissionLayer.updateFeatures();
    rallyLayer.updateFeatures();
    exclusionZoneLayer.updateFeatures();
}

/**
 * Strips bypass waypoints from any mission not represented in the given proposal set.
 * Call this after zone changes that may have eliminated previously necessary detours.
 * Missions with active proposals keep their current waypoints until the operator confirms.
 */
export function stripStaleBypasses(activeMissionIDs: Set<number> = new Set()) {
    for (const [missionID, mission] of missionSet.getMissions()) {
        if (activeMissionIDs.has(missionID)) continue;
        const all = mission.getWaypoints();
        const clean = all.filter((wp) => !wp.getIsBypass());
        if (clean.length !== all.length) mission.setWaypoints(clean);
    }
}

export function syncTaskLayers() {
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    contourLayer.updateFeatures();
    excludedTaskPacketsLayer.updateFeatures();
}

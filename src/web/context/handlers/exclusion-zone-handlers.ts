import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { bots } from "../../data/bots/bots";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import Waypoint from "../../data/waypoints/waypoint";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { JaiaContextType, JaiaAction } from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import { CommandType, ExclusionZone } from "../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { jaiaAPI } from "../../utils/jaia-api";
import { routeAroundExclusionZones } from "../../utils/exclusion-zone-router";

function syncLayer() {
    exclusionZoneLayer.setZones(exclusionZoneSet.getZones());
}

/**
 * Sends the current exclusion zone list (filtered for this bot) to a specific bot.
 * Always sends even when the list is empty so the bot can deactivate removed zones.
 */
export function sendExclusionZonesForBot(botID: number) {
    const zones = exclusionZoneSet.getZones();
    const zoneList: ExclusionZone[] = [];

    for (const [zoneID, zone] of zones) {
        const assignedBotIDs = exclusionZoneSet.getAssignment(zoneID);
        if (assignedBotIDs.includes(UNASSIGNED_ID) || assignedBotIDs.includes(botID)) {
            zoneList.push(zone);
        }
    }

    jaiaAPI.postCommand({
        bot_id: botID,
        time: Date.now() * 1000,
        type: CommandType.EXCLUSION_ZONES,
        exclusion_zones: { zone: zoneList },
    });
}

/**
 * Sends zone updates only to the bots that are actually affected.
 * If assignedBotIDs contains UNASSIGNED_ID the zone affects all bots,
 * otherwise only the listed bots receive an update.
 */
function sendZonesToAffectedBots(assignedBotIDs: number[]) {
    if (assignedBotIDs.includes(UNASSIGNED_ID)) {
        for (const [botID] of bots.getBots()) {
            sendExclusionZonesForBot(botID);
        }
    } else {
        for (const botID of assignedBotIDs) {
            sendExclusionZonesForBot(botID);
        }
    }
}

/** Sends zone updates to every known bot (used when the full set changes). */
function sendZonesToAllBots() {
    for (const [botID] of bots.getBots()) {
        sendExclusionZonesForBot(botID);
    }
}

/**
 * Re-routes all missions that are affected by the given bot IDs.
 * Called when a zone is added or reassigned so that existing waypoint paths
 * that now cross a zone get bypass waypoints inserted automatically.
 *
 * Bypass goals (name="route_bypass") are inserted as plain waypoints with no
 * task; original waypoints keep their locations and tasks unchanged.
 */
function rerouteAffectedMissions(affectedBotIDs: number[]) {
    const allBots = affectedBotIDs.includes(UNASSIGNED_ID);

    for (const [missionID, mission] of missionSet.getMissions()) {
        const botID = missionsManager.getBotID(missionID);
        if (!allBots && !affectedBotIDs.includes(botID)) continue;

        const plan = mission.packageMissionForHub("");
        const result = routeAroundExclusionZones(plan, botID);
        if (result.bypassCount === 0) continue;

        // Reconstruct waypoint list: preserve original waypoints (with tasks),
        // insert new empty Waypoint objects for each bypass goal.
        const originalWaypoints = mission.getWaypoints();
        const newWaypoints: Waypoint[] = [];
        let origIdx = 0;

        for (const goal of result.plan.goal ?? []) {
            if (goal.name === "route_bypass") {
                const wp = new Waypoint();
                wp.setLocation(goal.location!);
                newWaypoints.push(wp);
            } else {
                if (origIdx < originalWaypoints.length) {
                    newWaypoints.push(originalWaypoints[origIdx]);
                }
                origIdx++;
            }
        }

        mission.setWaypoints(newWaypoints);
    }

    missionLayer.updateFeatures();
}

/**
 * Adds a drawn polygon to the exclusion zone set and returns to default map mode.
 * New zones default to All Bots, so every bot is notified.
 */
export function handleAddExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZone) return mutableState;
    exclusionZoneSet.addZone(action.exclusionZone);
    syncLayer();
    handleMapModeChange(MapModes.DEFAULT);
    sendZonesToAllBots(); // default assignment is All Bots
    rerouteAffectedMissions([UNASSIGNED_ID]); // new zones default to all bots
    return mutableState;
}

/**
 * Deletes one exclusion zone by ID.
 * Only the bots that were receiving this zone need to be updated.
 */
export function handleDeleteExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined) return mutableState;
    const affected = exclusionZoneSet.getAssignment(action.zoneID); // read before delete
    exclusionZoneSet.deleteZone(action.zoneID);
    syncLayer();
    sendZonesToAffectedBots(affected);
    return mutableState;
}

/**
 * Assigns (or reassigns) a zone to a new set of bots.
 * Both the old and new assigned bots must receive an updated zone list.
 */
export function handleAssignExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.botIDs === undefined) return mutableState;
    const oldAssignment = exclusionZoneSet.getAssignment(action.zoneID);
    exclusionZoneSet.setAssignment(action.zoneID, action.botIDs);
    // Union of old + new — either side may include UNASSIGNED_ID (all bots)
    const affected = [...new Set([...oldAssignment, ...action.botIDs])];
    sendZonesToAffectedBots(affected);
    // Newly assigned bots may now have crossings — re-route their missions.
    rerouteAffectedMissions(action.botIDs);
    return mutableState;
}

/**
 * Clears all exclusion zones — every bot that had any zone must be notified.
 */
export function handleClearExclusionZones(mutableState: JaiaContextType) {
    exclusionZoneSet.clearZones();
    syncLayer();
    sendZonesToAllBots();
    return mutableState;
}

/**
 * Replaces all zones from a snapshot (e.g. loaded from storage or imported file).
 */
export function handleLoadExclusionZones(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZones) return mutableState;
    exclusionZoneSet.clearZones();
    for (const zone of action.exclusionZones) {
        exclusionZoneSet.addZone(zone);
    }
    syncLayer();
    sendZonesToAllBots();
    rerouteAffectedMissions([UNASSIGNED_ID]);
    return mutableState;
}

/**
 * Toggles EXCLUSION_ZONE_DRAWING map mode on/off
 */
export function handleToggleExclusionZoneDrawing(mutableState: JaiaContextType) {
    const updatedMode =
        jaiaGlobal.getMapMode() !== MapModes.EXCLUSION_ZONE_DRAWING
            ? MapModes.EXCLUSION_ZONE_DRAWING
            : MapModes.DEFAULT;
    handleMapModeChange(updatedMode);
    return mutableState;
}

/**
 * Restores zones from a full snapshot (used by ZoneStorage load/import)
 */
export function handleRestoreExclusionZoneSnapshot(
    mutableState: JaiaContextType,
    action: JaiaAction,
) {
    if (!action.exclusionZoneSnapshot) return mutableState;
    exclusionZoneSet.restoreFromSnapshot(action.exclusionZoneSnapshot);
    syncLayer();
    sendZonesToAllBots();
    rerouteAffectedMissions([UNASSIGNED_ID]);
    return mutableState;
}

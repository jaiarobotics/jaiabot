import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { handleMapModeChange } from "../../openlayers/maps/map";
import { exclusionZoneLayer } from "../../openlayers/layers/vector/exclusion-zone-layer";
import { JaiaContextType, JaiaAction } from "../../types/context-types";
import { MapModes } from "../../types/openlayers-types";
import { CommandType, ExclusionZones } from "../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../utils/constants";
import { jaiaAPI } from "../../utils/jaia-api";

function syncLayer() {
    exclusionZoneLayer.setZones(exclusionZoneSet.getZones());
}

/**
 * Adds a drawn polygon to the exclusion zone set and returns to default map mode
 */
export function handleAddExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZone) return mutableState;
    exclusionZoneSet.addZone(action.exclusionZone);
    syncLayer();
    handleMapModeChange(MapModes.DEFAULT);
    return mutableState;
}

/**
 * Deletes one exclusion zone by ID
 */
export function handleDeleteExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined) return mutableState;
    exclusionZoneSet.deleteZone(action.zoneID);
    syncLayer();
    return mutableState;
}

/**
 * Assigns (or unassigns) a bot to a specific zone
 */
export function handleAssignExclusionZone(mutableState: JaiaContextType, action: JaiaAction) {
    if (action.zoneID === undefined || action.botID === undefined) return mutableState;
    exclusionZoneSet.setAssignment(action.zoneID, action.botID);
    return mutableState;
}

/**
 * Clears all exclusion zones
 */
export function handleClearExclusionZones(mutableState: JaiaContextType) {
    exclusionZoneSet.clearZones();
    syncLayer();
    return mutableState;
}

/**
 * Replaces all zones from a snapshot (e.g. loaded from storage or imported file)
 */
export function handleLoadExclusionZones(mutableState: JaiaContextType, action: JaiaAction) {
    if (!action.exclusionZones) return mutableState;
    exclusionZoneSet.clearZones();
    for (const zone of action.exclusionZones) {
        exclusionZoneSet.addZone(zone);
    }
    syncLayer();
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
 * Sends exclusion zones applicable to a specific bot (zones assigned to it or to all bots).
 * Called automatically when a mission plan is sent to that bot.
 */
export function sendExclusionZonesForBot(botID: number) {
    const zones = exclusionZoneSet.getZones();
    const zoneList: ExclusionZones["zone"] = [];

    for (const [zoneID, zone] of zones) {
        const assignedBotID = exclusionZoneSet.getAssignment(zoneID);
        if (assignedBotID === UNASSIGNED_ID || assignedBotID === botID) {
            zoneList.push(zone);
        }
    }

    if (zoneList.length === 0) return;

    jaiaAPI.postCommand({
        bot_id: botID,
        time: Date.now() * 1000,
        type: CommandType.EXCLUSION_ZONES,
        exclusion_zones: { zone: zoneList },
    });
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
    return mutableState;
}

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
import {
    getBlockingZoneIDs,
    buildZoneBufferCache,
    routeNeedsBypass,
} from "../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router";
import cloneDeep from "lodash/cloneDeep";
import Waypoint from "../../data/waypoints/waypoint";
import { GeographicCoordinate } from "../../types/protobuf-types";

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
 * Strips bypass waypoints from any mission where a bypass falls inside the
 * safety buffer of the given zone. Returns the set of affected mission IDs.
 * Must be called BEFORE detectMissionReroutes() so the router works from
 * clean waypoints when re-planning around the new/modified zone.
 *
 * @param {number} zoneID ID of the zone whose buffer is checked against bypass waypoints
 * @returns {Set<number>} Mission IDs whose bypass waypoints were removed
 */
export function stripBypassesInsideZone(zoneID: number): Set<number> {
    return stripBypassesInsideZoneWithSnapshot(zoneID).affected;
}

/**
 * Same as stripBypassesInsideZone() but also captures mission waypoint snapshots
 * before mutation so callers can restore on cancel/revert.
 *
 * @param {number} zoneID ID of the zone whose buffer is checked against bypass waypoints
 * @returns {{ affected: Set<number>, priorMissionWaypoints: Map<number, Waypoint[]> }} Affected mission IDs and their pre-strip waypoint snapshots
 */
export function stripBypassesInsideZoneWithSnapshot(zoneID: number): {
    affected: Set<number>;
    priorMissionWaypoints: Map<number, Waypoint[]>;
} {
    const affected = new Set<number>();
    const priorMissionWaypoints = new Map<number, Waypoint[]>();
    // Build zone buffer geometry once for this call instead of letting each
    // bypass waypoint's getBlockingZoneIDs() call rebuild every zone from scratch.
    const zoneBufferCache = buildZoneBufferCache();
    for (const [missionID, mission] of missionSet.getMissions()) {
        const all = mission.getWaypoints();
        const hasBlockedBypass = all.some((wp) => {
            if (!wp.getIsBypass()) return false;
            const loc = wp.getLocation();
            return loc
                ? getBlockingZoneIDs(loc, undefined, zoneBufferCache).includes(zoneID)
                : false;
        });
        if (!hasBlockedBypass) continue;
        priorMissionWaypoints.set(missionID, cloneDeep(all));
        mission.setWaypoints(all.filter((wp) => !wp.getIsBypass()));
        affected.add(missionID);
    }
    return { affected, priorMissionWaypoints };
}

/**
 * Strips every bypass waypoint from every mission, leaving only the waypoints the
 * operator placed. Used when the whole zone set is replaced: each detour was computed
 * against zones that no longer exist, so all of them are recomputed from clean rather
 * than some being carried across.
 *
 * @returns {void}
 */
export function stripAllBypasses() {
    for (const [, mission] of missionSet.getMissions()) {
        const all = mission.getWaypoints();
        const clean = all.filter((wp) => !wp.getIsBypass());
        if (clean.length !== all.length) mission.setWaypoints(clean);
    }
}

/**
 * Strips bypass waypoints from missions whose routes no longer need a detour.
 * Call this after zone changes that may have eliminated previously necessary detours.
 * Missions with active proposals keep their current waypoints until the operator confirms.
 *
 * Absence from the proposal set does not by itself mean a detour is obsolete: reroute
 * detection also omits a mission whose current route already matches what it would
 * compute. Each candidate's clean route is therefore re-checked against the zones, and
 * its bypasses are kept if that route is still blocked.
 *
 * @param {Set<number>} activeMissionIDs Mission IDs with pending reroute proposals that should keep their bypasses
 * @returns {void}
 */
export function stripStaleBypasses(activeMissionIDs: Set<number> = new Set()) {
    for (const [missionID, mission] of missionSet.getMissions()) {
        if (activeMissionIDs.has(missionID)) continue;
        const all = mission.getWaypoints();
        const clean = all.filter((wp) => !wp.getIsBypass());
        if (clean.length === all.length) continue;

        const route = clean
            .map((wp) => wp.getLocation())
            .filter((location): location is GeographicCoordinate => !!location);
        if (routeNeedsBypass(route)) continue;

        mission.setWaypoints(clean);
    }
}

/**
 * Repaints the task-related map layers using the latest data
 *
 * @returns {void}
 */
export function syncTaskLayers() {
    diveLayer.updateFeatures();
    driftLayer.updateFeatures();
    contourLayer.updateFeatures();
    excludedTaskPacketsLayer.updateFeatures();
}

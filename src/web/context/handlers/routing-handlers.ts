import Mission from "../../data/mission_set/mission";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { missionSet } from "../../data/mission_set/mission-set";
import { exclusionZoneSet } from "../../data/exclusion_zones/exclusion-zone-set";
import { ButtonNames, JaiaAction, JaiaContextType } from "../../types/context-types";
import { RerouteOutcome } from "../../types/routing-types";
import { autoRoute, buildZoneGeometry, ZoneGeometry } from "../../utils/routing/router";
import { missionLayer } from "../../openlayers/layers/vector/mission-layer";

/**
 * Reroutes each mission from its original waypoints around the current zones, and stores
 * what happened to each in the reroute report. Missions with no waypoints are skipped.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionIDs Missions to reroute
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleRerouteMissions(mutableState: JaiaContextType, action: JaiaAction) {
    const geometry = buildZoneGeometry(exclusionZoneSet.getZones());
    mutableState.rerouteReport = updateMissions(
        mutableState,
        action.missionIDs ?? [],
        (mission, missionID) => rerouteMission(mission, missionID, geometry),
    );
    missionLayer.updateFeatures();
    return mutableState;
}

/**
 * Restores each mission's original waypoints, and stores what happened to each in the
 * reroute report.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including missionIDs Missions to restore
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleRestoreOriginalWaypoints(mutableState: JaiaContextType, action: JaiaAction) {
    mutableState.rerouteReport = updateMissions(
        mutableState,
        action.missionIDs ?? [],
        (mission, missionID) => ({
            missionID,
            kind: "restored",
            ...mission.restoreOriginalWaypoints(),
        }),
    );
    missionLayer.updateFeatures();
    return mutableState;
}

function rerouteMission(
    mission: Mission,
    missionID: number,
    geometry: ZoneGeometry,
): RerouteOutcome {
    const originals = mission.getOriginalWaypoints();
    const routing = autoRoute(
        originals.map((waypoint) => waypoint.getLocation()),
        geometry,
    );
    if (routing.kind === "noRoute") {
        const [from, to] = routing.leg.map((num) => mission.getWaypointNum(originals[num - 1]));
        return { missionID, kind: "noRoute", leg: from && to ? [from, to] : undefined };
    }
    if (routing.kind !== "routed") return { missionID, ...routing };
    return { missionID, ...mission.reroute(routing.steps) };
}

/**
 * Applies an update to each mission that has waypoints, and keeps the waypoint selection
 * on the same waypoint as the update renumbers it.
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {number[]} missionIDs Missions to update
 * @param {Function} update Changes one mission and returns its outcome
 * @returns {RerouteOutcome[]} One outcome per mission updated
 */
function updateMissions(
    mutableState: JaiaContextType,
    missionIDs: number[],
    update: (mission: Mission, missionID: number) => RerouteOutcome,
): RerouteOutcome[] {
    const outcomes: RerouteOutcome[] = [];
    for (const missionID of missionIDs) {
        const mission = missionSet.getMission(missionID);
        // Mission.reroute throws on a mission with no waypoints
        if (!mission || mission.getOriginalWaypoints().length === 0) continue;

        const selection = jaiaGlobal.getSelectedWaypoint();
        const selected =
            selection.missionID === missionID
                ? mission.getWaypoint(selection.waypointNum)
                : undefined;
        outcomes.push(update(mission, missionID));
        if (!selected) continue;

        const waypointNum = mission.getWaypointNum(selected);
        if (waypointNum === undefined) {
            jaiaGlobal.resetSelectedWaypoint();
            if (mutableState.visiblePanel === ButtonNames.WAYPOINT_PANEL) {
                mutableState.visiblePanel = ButtonNames.NONE;
            }
        } else {
            jaiaGlobal.setSelectedWaypoint({ ...selection, waypointNum });
        }
    }
    return outcomes;
}

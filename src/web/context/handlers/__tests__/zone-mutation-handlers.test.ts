import cloneDeep from "lodash/cloneDeep";

import {
    handleAddZoneVertex,
    handleDeleteZoneVertex,
    handleDeleteExclusionZone,
    handleClearExclusionZones,
} from "../exclusion-zone-handlers";
import {
    handleCancelMissionReroute,
    handleCancelWaypointRemoval,
} from "../obstacle-avoidance-handlers";
import { missionSet } from "../../../data/mission_set/mission-set";
import { obstacleAvoidanceData } from "../../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import Mission from "../../../data/mission_set/mission";
import { ExclusionZone } from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-set";
import { detectMissionReroutes } from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection";
import { ButtonNames } from "../../../types/context-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { makeMutableState, resetHandlerSingletons, coord, squareZone } from "./handler-test-utils";

/**
 * Characterization tests for the four zone handlers that mutate the zone set
 * without going through handleAddExclusionZone/handleMoveZoneVertex (already
 * covered by reroute-revert-producers.test.ts).
 *
 */

// ── Zone geometry ──────────────────────────────────────────────────────────────
//
// RECT is a tall, narrow rectangle wound SW -> SE -> NE -> NW, the same winding
// squareZone() uses. Its west edge (NW -> SW) closes the ring, and that closing
// edge is where ExclusionZoneSet.addVertex() appends — so appending APEX turns
// the rectangle into a rectangle plus a wedge pointing west.
//
// CROSSING_ROUTE runs north-south at lon -72.002, which is 84 m clear of RECT's
// west edge but passes through the fat part of the wedge (~150 m of latitude
// there). That gives one shape where a single vertex is the entire difference
// between "route is clear" and "route is blocked".

const RECT_SW = coord(40.999, -72.001);
const RECT_SE = coord(40.999, -72.0);
const RECT_NE = coord(41.001, -72.0);
const RECT_NW = coord(41.001, -72.001);
const APEX = coord(41.0, -72.004);
const APEX_INDEX = 4;

function rectZone(): ExclusionZone {
    return { vertices: [RECT_SW, RECT_SE, RECT_NE, RECT_NW] };
}

function wedgeZone(): ExclusionZone {
    return { vertices: [RECT_SW, RECT_SE, RECT_NE, RECT_NW, APEX] };
}

const CROSSING_ROUTE: [number, number][] = [
    [40.998, -72.002],
    [41.002, -72.002],
];

function addMission(waypoints: [number, number][]): number {
    const mission = new Mission();
    for (const [lat, lon] of waypoints) mission.addWaypoint(coord(lat, lon));
    return missionSet.addMission(mission);
}

/**
 * Applies the reroute the current zone set requires, standing in for an operator
 * confirming the dialog. Returns the mission's post-confirm waypoints.
 */
function confirmReroute(missionID: number) {
    const pending = detectMissionReroutes();
    expect(pending).not.toBeNull();
    const proposal = pending!.proposals.find((p) => p.missionID === missionID);
    expect(proposal).toBeDefined();
    missionSet.getMission(missionID).setWaypoints(proposal!.newWaypoints);
    expect(bypassCount(missionID)).toBeGreaterThan(0);
    return cloneDeep(missionSet.getMission(missionID).getWaypoints());
}

function bypassCount(missionID: number): number {
    return missionSet
        .getMission(missionID)
        .getWaypoints()
        .filter((wp) => wp.getIsBypass()).length;
}

beforeEach(resetHandlerSingletons);

describe("handleAddZoneVertex", () => {
    test("growing a zone onto a mission's route stages a reroute with a restoreZoneShape revert; cancel restores the shape", () => {
        addMission(CROSSING_ROUTE);
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(rectZone());
        const priorZone = cloneDeep(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID));

        // No crossing yet — the route runs clear of the rectangle's west edge.
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();

        handleAddZoneVertex(makeMutableState(), { zoneID, location: APEX } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "restoreZoneShape", zoneID, zone: priorZone },
        ]);

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toEqual(priorZone);
    });

    test("growing a zone over a waypoint stages a waypoint removal instead of a reroute", () => {
        // First waypoint sits inside the wedge once APEX is added; second is well south of it.
        addMission([
            [41.0, -72.002],
            [40.996, -72.002],
        ]);
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(rectZone());
        const priorZone = cloneDeep(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID));

        handleAddZoneVertex(makeMutableState(), { zoneID, location: APEX } as any);

        // Waypoints inside the zone take priority over rerouting around it.
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("waypointRemoval");
        expect(pending!.type === "waypointRemoval" && pending.data.revert).toEqual([
            { kind: "restoreZoneShape", zoneID, zone: priorZone },
        ]);

        handleCancelWaypointRemoval(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toEqual(priorZone);
    });

    test("selects the new vertex and opens the vertex panel", () => {
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(rectZone());

        const state = handleAddZoneVertex(makeMutableState(), { zoneID, location: APEX } as any);

        expect(jaiaGlobal.getSelectedZoneVertex()).toEqual({
            zoneID,
            vertexIndex: APEX_INDEX,
            isMoveable: false,
        });
        expect(state.visiblePanel).toBe(ButtonNames.ZONE_VERTEX_PANEL);
    });
});

describe("handleDeleteZoneVertex", () => {
    test("deleting a vertex that leaves the crossing intact stages a reroute with a restoreZoneShape revert", () => {
        addMission(CROSSING_ROUTE);
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(wedgeZone());
        const priorZone = cloneDeep(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID));

        // Drop RECT_SE, a rectangle corner well east of the route. The wedge —
        // and therefore the crossing — is untouched.
        handleDeleteZoneVertex(makeMutableState(), { zoneID, vertexIndex: 1 } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "restoreZoneShape", zoneID, zone: priorZone },
        ]);

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toEqual(priorZone);
    });

    test("deleting the vertex that caused the crossing strips the mission's now-unneeded bypasses", () => {
        const missionID = addMission(CROSSING_ROUTE);
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(wedgeZone());
        const reroutedWaypoints = confirmReroute(missionID);
        obstacleAvoidanceData.setPendingChange(null);

        // Removing APEX collapses the wedge back to the rectangle, which the
        // route clears — the bypasses are genuinely obsolete.
        handleDeleteZoneVertex(makeMutableState(), { zoneID, vertexIndex: APEX_INDEX } as any);

        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
        expect(bypassCount(missionID)).toBe(0);
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(
            reroutedWaypoints.filter((wp) => !wp.getIsBypass()),
        );
    });

    test("refuses to delete when only three vertices remain", () => {
        const triangle: ExclusionZone = { vertices: [RECT_SW, RECT_SE, RECT_NE] };
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(triangle);

        handleDeleteZoneVertex(makeMutableState(), { zoneID, vertexIndex: 0 } as any);

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)!.vertices).toHaveLength(
            3,
        );
    });
});

describe("handleDeleteExclusionZone", () => {
    test("removes the zone and strips the bypasses it required", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const reroutedWaypoints = confirmReroute(missionID);
        obstacleAvoidanceData.setPendingChange(null);

        handleDeleteExclusionZone(makeMutableState(), { zoneID } as any);

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toBeUndefined();
        expect(bypassCount(missionID)).toBe(0);
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(
            reroutedWaypoints.filter((wp) => !wp.getIsBypass()),
        );
    });

    test("clears vertex selection and edit mode belonging to the deleted zone", () => {
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        jaiaGlobal.setSelectedZoneVertex({ zoneID, vertexIndex: 2, isMoveable: true });
        jaiaGlobal.setZoneInEditMode(zoneID);

        handleDeleteExclusionZone(makeMutableState(), { zoneID } as any);

        expect(jaiaGlobal.getSelectedZoneVertex()).toEqual({
            zoneID: UNASSIGNED_ID,
            vertexIndex: UNASSIGNED_ID,
            isMoveable: false,
        });
        expect(jaiaGlobal.getZoneInEditMode()).toBe(UNASSIGNED_ID);
    });

    test("leaves vertex selection and edit mode belonging to a different zone alone", () => {
        const keptZoneID = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(41.0, -72.0));
        const doomedZoneID = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(41.05, -72.05));
        jaiaGlobal.setSelectedZoneVertex({ zoneID: keptZoneID, vertexIndex: 2, isMoveable: true });
        jaiaGlobal.setZoneInEditMode(keptZoneID);

        handleDeleteExclusionZone(makeMutableState(), { zoneID: doomedZoneID } as any);

        expect(jaiaGlobal.getSelectedZoneVertex()).toEqual({
            zoneID: keptZoneID,
            vertexIndex: 2,
            isMoveable: true,
        });
        expect(jaiaGlobal.getZoneInEditMode()).toBe(keptZoneID);
    });
});

describe("handleClearExclusionZones", () => {
    test("removes every zone and strips every bypass", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.05, -72.05));
        confirmReroute(missionID);
        obstacleAvoidanceData.setPendingChange(null);

        handleClearExclusionZones(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZones().size).toBe(0);
        expect(bypassCount(missionID)).toBe(0);
    });

    test("resets vertex selection and edit mode", () => {
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        jaiaGlobal.setSelectedZoneVertex({ zoneID, vertexIndex: 1, isMoveable: true });
        jaiaGlobal.setZoneInEditMode(zoneID);

        handleClearExclusionZones(makeMutableState());

        expect(jaiaGlobal.getSelectedZoneVertex()).toEqual({
            zoneID: UNASSIGNED_ID,
            vertexIndex: UNASSIGNED_ID,
            isMoveable: false,
        });
        expect(jaiaGlobal.getZoneInEditMode()).toBe(UNASSIGNED_ID);
    });
});

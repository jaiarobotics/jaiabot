import cloneDeep from "lodash/cloneDeep";

import {
    handleAddExclusionZone,
    handleAddZoneVertex,
    handleMoveZoneVertex,
    handleDeleteZoneVertex,
    handleDeleteExclusionZone,
    handleClearExclusionZones,
    handleLoadExclusionZones,
    handleRestoreExclusionZoneSnapshot,
} from "../exclusion-zone-handlers";
import {
    handleCancelMissionReroute,
    handleCancelWaypointRemoval,
    handleConfirmMissionReroute,
} from "../obstacle-avoidance-handlers";
import { ProposalStatus } from "../../../data/obstacle_avoidance_data/pending-route-data";
import { missionSet } from "../../../data/mission_set/mission-set";
import { obstacleAvoidanceData } from "../../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import Mission from "../../../data/mission_set/mission";
import Waypoint from "../../../data/waypoints/waypoint";
import { ExclusionZone } from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-set";
import { detectMissionReroutes } from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection";
import { routeNeedsBypass } from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-router";
import { ButtonNames } from "../../../types/context-types";
import { MAX_WAYPOINTS, UNASSIGNED_ID } from "../../../utils/constants";
import { makeMutableState, resetHandlerSingletons, coord, squareZone } from "./handler-test-utils";

/**
 * Characterization tests for the four zone handlers that mutate the zone set
 * without going through handleAddExclusionZone/handleMoveZoneVertex (already
 * covered by reroute-revert-producers.test.ts).
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

// NOTCHED is a square with a wide slot cut up into it from the south edge, laid out on
// a grid of 0.0002 deg steps from (41.0, -72.0). Vertices 2 and 3 are the slot's upper
// corners and are reflex: deleting either one fills part of the slot, so the zone covers
// MORE ground after the deletion than before. NOTCH_INTERIOR sits in the part that gets
// filled, well clear of the slot walls so the safety buffer does not reach it beforehand.
const STEP = 0.0002;
const gridCoord = (x: number, y: number) => coord(41.0 + y * STEP, -72.0 + x * STEP);
const NOTCHED_REFLEX_INDEX = 2;

function notchedZone(): ExclusionZone {
    return {
        vertices: [
            gridCoord(0, 0),
            gridCoord(3, 0),
            gridCoord(3, 6),
            gridCoord(7, 6),
            gridCoord(7, 0),
            gridCoord(10, 0),
            gridCoord(10, 10),
            gridCoord(0, 10),
        ],
    };
}

const NOTCH_INTERIOR: [number, number] = [41.0 + 4 * STEP, -72.0 + 5 * STEP];
const BELOW_ZONE: [number, number] = [41.0 - 5 * STEP, -72.0 + 5 * STEP];

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

// A long east-west line of waypoints 84 m apart, used to push a rerouted mission
// past MAX_WAYPOINTS: any inserted bypass takes a full-length line over the limit.
function addLineMission(count: number): number {
    const waypoints: [number, number][] = [];
    for (let i = 0; i < count; i++) waypoints.push([41.0, -72.1 + i * 0.001]);
    return addMission(waypoints);
}

/** A zone small enough to sit in the gap between two consecutive line waypoints. */
function gapZone(lon: number): ExclusionZone {
    return squareZone(41.0, lon, 0.0002);
}

function zoneIDs(): number[] {
    return Array.from(obstacleAvoidanceData.getExclusionZoneSet().getZones().keys());
}

beforeEach(resetHandlerSingletons);

describe("handleAddExclusionZone", () => {
    test("a zone landing on an existing bypass waypoint stages a reroute that reverts the waypoints before the zone", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const firstZoneID = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(41.0, -72.0));
        const reroutedWaypoints = confirmReroute(missionID);
        obstacleAvoidanceData.setPendingChange(null);

        // Drop a second zone directly over one of the detour's bypass waypoints, so
        // the bypass has to be discarded and the mission re-planned from clean.
        const bypass = reroutedWaypoints.find((wp) => wp.getIsBypass())!;
        const bypassLocation = bypass.getLocation()!;
        handleAddExclusionZone(makeMutableState(), {
            exclusionZone: squareZone(bypassLocation.lat, bypassLocation.lon, 0.0002),
        } as any);

        const secondZoneID = Array.from(
            obstacleAvoidanceData.getExclusionZoneSet().getZones().keys(),
        ).find((id) => id !== firstZoneID)!;
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "restoreWaypoints", missions: [{ missionID, waypoints: reroutedWaypoints }] },
            { kind: "deleteZone", zoneID: secondZoneID },
        ]);

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(secondZoneID)).toBeUndefined();
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(reroutedWaypoints);
    });
});

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

describe("handleLoadExclusionZones", () => {
    test("replaces the existing zone set and stages a reroute carrying a zoneLoad summary and no revert", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.5, -72.5));
        addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);

        handleLoadExclusionZones(makeMutableState(), {
            exclusionZones: [squareZone(41.0, -72.0)],
        } as any);

        // The pre-existing zone is gone: a load replaces the set rather than merging.
        expect(zoneIDs()).toHaveLength(1);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([]);
        expect(pending!.type === "reroute" && pending.data.loadSummary).toEqual({
            kind: "zoneLoad",
            loadedZoneIDs: zoneIDs(),
            skippedZoneIDs: [],
        });
    });

    test("stages a waypoint removal with no revert when a loaded zone encloses a waypoint", () => {
        addMission([
            [41.0, -72.0],
            [41.0, -71.99],
        ]);

        handleLoadExclusionZones(makeMutableState(), {
            exclusionZones: [squareZone(41.0, -72.0)],
        } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("waypointRemoval");
        expect(pending!.type === "waypointRemoval" && pending.data.revert).toEqual([]);
    });

    test("drops a loaded zone that would push a rerouted mission over the waypoint limit", () => {
        addLineMission(MAX_WAYPOINTS);

        handleLoadExclusionZones(makeMutableState(), {
            // The first zone blocks the line between two waypoints; the second is clear of it.
            exclusionZones: [gapZone(-72.0605), squareZone(41.002, -72.0595, 0.0003)],
        } as any);

        const surviving = zoneIDs();
        expect(surviving).toHaveLength(1);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.loadSummary).toEqual({
            kind: "zoneLoad",
            loadedZoneIDs: surviving,
            skippedZoneIDs: [expect.any(Number)],
        });
    });

    test("drops a loaded zone whose enclosed-waypoint removal would leave the mission over the limit", () => {
        addLineMission(MAX_WAYPOINTS + 1);

        handleLoadExclusionZones(makeMutableState(), {
            exclusionZones: [gapZone(-72.06)],
        } as any);

        // Removing the enclosed waypoint leaves a route that still needs a detour around
        // the same zone, which no longer fits — so the zone is dropped and nothing is staged.
        expect(zoneIDs()).toHaveLength(0);
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });
});

describe("handleRestoreExclusionZoneSnapshot", () => {
    test("stages a reroute carrying a zoneLoad summary and no revert", () => {
        addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const snapshot = obstacleAvoidanceData.getExclusionZoneSet().captureSnapshot();
        obstacleAvoidanceData.getExclusionZoneSet().clearZones();

        handleRestoreExclusionZoneSnapshot(makeMutableState(), {
            exclusionZoneSnapshot: snapshot,
        } as any);

        expect(zoneIDs()).toHaveLength(1);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([]);
        expect(pending!.type === "reroute" && pending.data.loadSummary).toEqual({
            kind: "zoneLoad",
            loadedZoneIDs: zoneIDs(),
            skippedZoneIDs: [],
        });
    });

    test("keeps a restored zone whose enclosed-waypoint removal would leave the mission over the limit", () => {
        addLineMission(MAX_WAYPOINTS + 1);
        obstacleAvoidanceData.getExclusionZoneSet().addZone(gapZone(-72.06));
        const snapshot = obstacleAvoidanceData.getExclusionZoneSet().captureSnapshot();
        obstacleAvoidanceData.getExclusionZoneSet().clearZones();

        handleRestoreExclusionZoneSnapshot(makeMutableState(), {
            exclusionZoneSnapshot: snapshot,
        } as any);

        // Unlike a load, a restore keeps the zone and stages the removal dialog.
        expect(zoneIDs()).toHaveLength(1);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("waypointRemoval");
        expect(pending!.type === "waypointRemoval" && pending.data.revert).toEqual([]);
    });
});

describe("edits to an unrelated zone", () => {
    // Runs through the zone close to its northern edge, so detouring north is
    // decisively shorter than south and the computed route is stable.
    const CROSSED_ROUTE: [number, number][] = [
        [41.0004, -72.005],
        [41.0004, -71.995],
    ];

    /**
     * Gives the mission a confirmed detour around one zone, alongside a second zone
     * that affects nothing. The second zone is deliberately small, sits well south of
     * both the route and its northward detour, and lies inside the bounding box the
     * first zone already defines — so editing it cannot shift the pathfinding grid or
     * change the detour that was confirmed.
     */
    function missionDetouredPastAnUnrelatedZone() {
        const missionID = addMission(CROSSED_ROUTE);
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const unrelatedZoneID = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(40.99965, -72.004, 0.0001));
        const reroutedWaypoints = confirmReroute(missionID);
        obstacleAvoidanceData.setPendingChange(null);
        return { missionID, unrelatedZoneID, reroutedWaypoints };
    }

    test("moving a vertex on an unrelated zone keeps a still-needed detour", () => {
        const { missionID, unrelatedZoneID, reroutedWaypoints } =
            missionDetouredPastAnUnrelatedZone();

        jaiaGlobal.setSelectedZoneVertex({
            zoneID: unrelatedZoneID,
            vertexIndex: 0,
            isMoveable: false,
        });
        handleMoveZoneVertex(makeMutableState(), { location: coord(40.9997, -72.00395) } as any);

        // No proposal is staged because the mission's route is already correct — which is
        // exactly why its waypoints must not be treated as obsolete.
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
        expect(bypassCount(missionID)).toBeGreaterThan(0);
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(reroutedWaypoints);
    });

    test("deleting a vertex on an unrelated zone keeps a still-needed detour", () => {
        const { missionID, unrelatedZoneID, reroutedWaypoints } =
            missionDetouredPastAnUnrelatedZone();

        handleDeleteZoneVertex(makeMutableState(), {
            zoneID: unrelatedZoneID,
            vertexIndex: 0,
        } as any);

        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
        expect(bypassCount(missionID)).toBeGreaterThan(0);
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(reroutedWaypoints);
    });
});

describe("deleting a zone while others remain", () => {
    // Runs near the northern edge of both zones, so detouring north is decisively
    // shorter than south and the computed route is stable.
    const ROUTE_ACROSS_TWO_ZONES: [number, number][] = [
        [41.0004, -72.005],
        [41.0004, -71.995],
    ];

    function missionDetouredAroundTwoZones() {
        const missionID = addMission(ROUTE_ACROSS_TWO_ZONES);
        const firstZoneID = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(41.0, -72.002));
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -71.998));
        confirmReroute(missionID);
        obstacleAvoidanceData.setPendingChange(null);
        return { missionID, firstZoneID };
    }

    /** Eastern edge of the zone the tests delete, before its safety buffer. */
    const DELETED_ZONE_EAST_EDGE = -72.0015;

    function currentRoute(missionID: number) {
        return missionSet
            .getMission(missionID)
            .getWaypoints()
            .map((wp) => wp.getLocation()!);
    }

    test("proposes a new route when a remaining zone still blocks the mission", () => {
        const { missionID, firstZoneID } = missionDetouredAroundTwoZones();
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());

        handleDeleteExclusionZone(makeMutableState(), { zoneID: firstZoneID } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        // The deletion stands either way, so there is nothing to revert.
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([]);
        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(firstZoneID)).toBeUndefined();
        // Nothing is applied to the mission until the operator confirms.
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });

    test("confirming drops the detour around the deleted zone and keeps the rest", () => {
        const { missionID, firstZoneID } = missionDetouredAroundTwoZones();

        handleDeleteExclusionZone(makeMutableState(), { zoneID: firstZoneID } as any);
        expect(obstacleAvoidanceData.getPendingChange()?.type).toBe("reroute");
        handleConfirmMissionReroute(makeMutableState());

        const bypassLocations = missionSet
            .getMission(missionID)
            .getWaypoints()
            .filter((wp) => wp.getIsBypass())
            .map((wp) => wp.getLocation()!);

        // Still detouring, but no longer reaching back over where the deleted zone was.
        expect(bypassLocations.length).toBeGreaterThan(0);
        expect(bypassLocations.every((loc) => loc.lon! > DELETED_ZONE_EAST_EDGE)).toBe(true);
        expect(routeNeedsBypass(currentRoute(missionID))).toBe(false);
    });

    test("declining leaves the mission's existing route untouched", () => {
        const { missionID, firstZoneID } = missionDetouredAroundTwoZones();
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());

        handleDeleteExclusionZone(makeMutableState(), { zoneID: firstZoneID } as any);
        expect(obstacleAvoidanceData.getPendingChange()?.type).toBe("reroute");
        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(firstZoneID)).toBeUndefined();
    });
});

describe("deleting a vertex that enlarges a concave zone", () => {
    test("detects a waypoint the filled notch now encloses", () => {
        addMission([NOTCH_INTERIOR, BELOW_ZONE]);

        // The waypoint sits in the open slot, so adding the zone flags nothing.
        handleAddExclusionZone(makeMutableState(), { exclusionZone: notchedZone() } as any);
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();

        const zoneID = zoneIDs()[0];
        const priorZone = cloneDeep(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID));

        handleDeleteZoneVertex(makeMutableState(), {
            zoneID,
            vertexIndex: NOTCHED_REFLEX_INDEX,
        } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("waypointRemoval");
        expect(pending!.type === "waypointRemoval" && pending.data.totalRemovedCount).toBe(1);
        expect(pending!.type === "waypointRemoval" && pending.data.revert).toEqual([
            { kind: "restoreZoneShape", zoneID, zone: priorZone },
        ]);

        handleCancelWaypointRemoval(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toEqual(priorZone);
    });

    test("discards a detour waypoint the filled notch now contains", () => {
        // The mission's own route crosses the zone, so its detour is still required and
        // cannot be discarded as stale — only the enlarged zone can account for the
        // waypoint disappearing. The detour waypoint is placed directly rather than
        // routed, since producing one inside a notch would need a contrived zone layout.
        const mission = new Mission();
        mission.addWaypoint(gridCoord(5, -5));
        mission.addWaypoint(gridCoord(5, 12));
        const missionID = missionSet.addMission(mission);
        const detourWaypoint = new Waypoint();
        detourWaypoint.setLocation(gridCoord(5, 4));
        detourWaypoint.setIsBypass(true);
        const [start, end] = mission.getWaypoints();
        mission.setWaypoints([start, detourWaypoint, end]);

        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(notchedZone());
        expect(bypassCount(missionID)).toBe(1);

        handleDeleteZoneVertex(makeMutableState(), {
            zoneID,
            vertexIndex: NOTCHED_REFLEX_INDEX,
        } as any);

        expect(bypassCount(missionID)).toBe(0);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        // The discarded waypoint is captured so cancelling can put it back.
        expect(pending!.type === "reroute" && pending.data.revert[0]).toEqual({
            kind: "restoreWaypoints",
            missions: [{ missionID, waypoints: [start, detourWaypoint, end] }],
        });
    });
});

describe("deleting a zone while a waypoint sits inside another", () => {
    /**
     * Declining a load leaves its zones in place, so a waypoint can legitimately end up
     * inside one. Routing reports any leg starting or ending inside a zone as unroutable,
     * so re-planning a mission in that state would classify it IMPOSSIBLE — which confirm
     * resolves by deleting the mission. Removal has to be settled first.
     */
    function waypointLeftInsideALoadedZone() {
        const missionID = addMission([
            [41.0, -72.0],
            [41.0, -71.99],
        ]);

        handleLoadExclusionZones(makeMutableState(), {
            exclusionZones: [
                squareZone(41.0, -72.0), // encloses the mission's first waypoint
                squareZone(41.0, -71.995), // blocks the leg between the two waypoints
                squareZone(41.01, -72.0), // clear of the mission entirely
            ],
        } as any);
        expect(obstacleAvoidanceData.getPendingChange()?.type).toBe("waypointRemoval");

        handleCancelWaypointRemoval(makeMutableState());
        expect(zoneIDs()).toHaveLength(3);
        expect(missionSet.getMission(missionID).getWaypoints()).toHaveLength(2);

        return { missionID, unrelatedZoneID: zoneIDs()[2] };
    }

    test("asks about the enclosed waypoint instead of declaring the mission unroutable", () => {
        const { missionID, unrelatedZoneID } = waypointLeftInsideALoadedZone();

        handleDeleteExclusionZone(makeMutableState(), { zoneID: unrelatedZoneID } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("waypointRemoval");
        expect(missionSet.getMission(missionID)).toBeDefined();
    });

    test("never reports a routable mission as impossible", () => {
        const { unrelatedZoneID } = waypointLeftInsideALoadedZone();

        handleDeleteExclusionZone(makeMutableState(), { zoneID: unrelatedZoneID } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        const rerouteStatuses =
            pending?.type === "reroute" ? pending.data.proposals.map((p) => p.status) : [];
        expect(rerouteStatuses).not.toContain(ProposalStatus.IMPOSSIBLE);
    });
});

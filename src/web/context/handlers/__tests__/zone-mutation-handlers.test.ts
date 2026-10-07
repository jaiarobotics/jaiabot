import cloneDeep from "lodash/cloneDeep";

import {
    handleAddExclusionZone,
    handleAddZoneVertex,
    handleMoveZoneVertex,
    handleDeleteZoneVertex,
    handleDeleteExclusionZone,
    handleClearExclusionZones,
    handleLoadExclusionZoneSet,
} from "../exclusion-zone-handlers";
import { missionSet } from "../../../data/mission_set/mission-set";
import { obstacleAvoidanceData } from "../../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import Mission from "../../../data/mission_set/mission";
import {
    ExclusionZone,
    ExclusionZoneSetSnapshot,
} from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-set";
import { ButtonNames, JaiaContextType } from "../../../types/context-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { makeMutableState, resetHandlerSingletons, coord, squareZone } from "./handler-test-utils";

// RECT is a tall, narrow rectangle wound SW -> SE -> NE -> NW, the same winding
// squareZone() uses. addVertex() appends after NW, so appending APEX lands at index 4.
const RECT_SW = coord(40.999, -72.001);
const RECT_SE = coord(40.999, -72.0);
const RECT_NE = coord(41.001, -72.0);
const RECT_NW = coord(41.001, -72.001);
const APEX = coord(41.0, -72.004);
const APEX_INDEX = 4;

function rectZone(): ExclusionZone {
    return { vertices: [RECT_SW, RECT_SE, RECT_NE, RECT_NW] };
}

/** Wraps bare zones in the snapshot shape the load handler receives from storage. */
function zoneSetSnapshot(zones: ExclusionZone[], name = "loaded-set"): ExclusionZoneSetSnapshot {
    return {
        zones: zones.map((zone, index): [number, ExclusionZone] => [index + 1, zone]),
        nextZoneID: zones.length + 1,
        name,
    };
}

/**
 * A mission whose route crosses RECT and already carries a detour waypoint, so a test
 * can tell whether a zone edit touched either the operator's waypoints or the detour.
 */
function addRoutedMission(): number {
    const mission = Mission.fromJSON({
        waypoints: [
            { location: coord(40.998, -72.002) },
            { location: coord(41.0, -72.003), isDetour: true },
            { location: coord(41.002, -72.002) },
        ],
    } as any);
    expect(mission.getWaypoint(2)!.getIsDetour()).toBe(true);
    return missionSet.addMission(mission);
}

function zoneIDs(): number[] {
    return Array.from(obstacleAvoidanceData.getExclusionZoneSet().getZones().keys());
}

beforeEach(resetHandlerSingletons);

describe("zone edits never change a mission's waypoints", () => {
    const edits: [string, (state: JaiaContextType, zoneID: number) => void][] = [
        [
            "adding a zone",
            (state) => handleAddExclusionZone(state, { exclusionZone: rectZone() } as any),
        ],
        [
            "adding a vertex",
            (state, zoneID) => handleAddZoneVertex(state, { zoneID, location: APEX } as any),
        ],
        [
            "moving a vertex",
            (state, zoneID) => {
                jaiaGlobal.setSelectedZoneVertex({ zoneID, vertexIndex: 0, isMoveable: true });
                handleMoveZoneVertex(state, { location: coord(40.998, -72.0015) } as any);
            },
        ],
        [
            "deleting a vertex",
            (state, zoneID) => handleDeleteZoneVertex(state, { zoneID, vertexIndex: 0 } as any),
        ],
        ["deleting a zone", (state, zoneID) => handleDeleteExclusionZone(state, { zoneID } as any)],
        ["clearing all zones", (state) => handleClearExclusionZones(state)],
        [
            "loading a zone set",
            (state) =>
                handleLoadExclusionZoneSet(state, {
                    exclusionZoneSetSnapshot: zoneSetSnapshot([squareZone(41.5, -72.5)]),
                } as any),
        ],
    ];

    test.each(edits)("%s leaves waypoints, detours and the dialog alone", (_, edit) => {
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(rectZone());
        const missionID = addRoutedMission();
        const before = cloneDeep(missionSet.getMission(missionID).getWaypoints());

        edit(makeMutableState(), zoneID);

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(before);
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });
});

describe("handleAddZoneVertex", () => {
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
    test("removes every zone", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.05, -72.05));

        handleClearExclusionZones(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZones().size).toBe(0);
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

describe("handleLoadExclusionZoneSet", () => {
    test("replaces the existing zone set rather than merging into it", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.5, -72.5));

        handleLoadExclusionZoneSet(makeMutableState(), {
            exclusionZoneSetSnapshot: zoneSetSnapshot([squareZone(41.0, -72.0)], "harbour"),
        } as any);

        expect(zoneIDs()).toHaveLength(1);
        expect(obstacleAvoidanceData.getExclusionZoneSet().getName()).toBe("harbour");
    });
});

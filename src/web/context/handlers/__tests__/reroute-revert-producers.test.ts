import cloneDeep from "lodash/cloneDeep";

import { handleAddExclusionZone, handleMoveZoneVertex } from "../exclusion-zone-handlers";
import { handleDuplicateMission } from "../mission-handlers";
import { handleAddWaypoint, handleMoveWaypoint, handleDeleteWaypoint } from "../waypoint-handlers";
import { handleChangeGridPlanningState } from "../survey-handlers";
import {
    handleCancelMissionReroute,
    handleCancelWaypointRemoval,
} from "../obstacle-avoidance-handlers";
import { missionSet } from "../../../data/mission_set/mission-set";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { obstacleAvoidanceData } from "../../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import { gridPlan } from "../../../data/survey_planner/grid-plan";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import Mission from "../../../data/mission_set/mission";
import { GridPlanningStates } from "../../../data/survey_planner/grid-plan";
import { detectMissionReroutes } from "../../../data/obstacle_avoidance_data/exclusion_zones/exclusion-zone-detection";
import { makeMutableState, resetHandlerSingletons, coord, squareZone } from "./handler-test-utils";

function addMission(waypoints: [number, number][]): number {
    const mission = new Mission();
    for (const [lat, lon] of waypoints) mission.addWaypoint(coord(lat, lon));
    return missionSet.addMission(mission);
}

beforeEach(resetHandlerSingletons);

describe("handleAddExclusionZone — revert-list construction", () => {
    test("staging a reroute records a deleteZone revert; cancel removes only the zone", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());

        handleAddExclusionZone(makeMutableState(), {
            exclusionZone: squareZone(41.0, -72.0),
        } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        const zoneID = Array.from(obstacleAvoidanceData.getExclusionZoneSet().getZones().keys())[0];
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "deleteZone", zoneID },
        ]);
        // Nothing is applied to the mission until confirm — staging is non-destructive.
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toBeUndefined();
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });

    test("staging a waypoint removal records a deleteZone revert; cancel removes only the zone", () => {
        const missionID = addMission([
            [41.0, -72.0],
            [42.0, -73.0],
        ]);
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());

        handleAddExclusionZone(makeMutableState(), {
            exclusionZone: squareZone(41.0, -72.0),
        } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("waypointRemoval");
        const zoneID = Array.from(obstacleAvoidanceData.getExclusionZoneSet().getZones().keys())[0];
        expect(pending!.type === "waypointRemoval" && pending.data.revert).toEqual([
            { kind: "deleteZone", zoneID },
        ]);

        handleCancelWaypointRemoval(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toBeUndefined();
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });
});

describe("handleMoveZoneVertex — revert-list construction", () => {
    test("moving a vertex to create a new crossing records a restoreZoneShape revert; cancel restores the shape", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        // Zone starts just north of the mission's route, so no crossing exists yet.
        const zoneID = obstacleAvoidanceData
            .getExclusionZoneSet()
            .addZone(squareZone(41.002, -72.0));
        const priorZone = cloneDeep(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID));

        jaiaGlobal.setSelectedZoneVertex({ zoneID, vertexIndex: 0, isMoveable: false });
        // Drag vertex 0 (the zone's southwest corner) down onto the mission's route,
        // creating a crossing that didn't exist before.
        handleMoveZoneVertex(makeMutableState(), { location: coord(40.9995, -72.0005) } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "restoreZoneShape", zoneID, zone: priorZone },
        ]);

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toEqual(priorZone);
    });
});

describe("handleDuplicateMission — revert-list construction", () => {
    test("duplicating a mission whose route crosses a zone stages a restoreMissionSnapshot revert; cancel removes the duplicate", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        missionsManager.assign(9, missionID);
        const missionCountBefore = missionSet.getMissions().size;

        handleDuplicateMission(makeMutableState(), { missionID } as any);

        expect(missionSet.getMissions().size).toBe(missionCountBefore + 1);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toHaveLength(1);
        expect(pending!.type === "reroute" && pending.data.revert[0].kind).toBe(
            "restoreMissionSnapshot",
        );

        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMissions().size).toBe(missionCountBefore);
        expect(missionSet.getMission(missionID)).toBeDefined();
        expect(missionsManager.getBotID(missionID)).toBe(9);
    });
});

describe("handleAddWaypoint — revert-list construction", () => {
    test("adding a waypoint that creates a crossing stages a restoreWaypoints revert; cancel removes the added waypoint", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const missionID = addMission([[41.0, -72.005]]); // addMission() also enters edit mode for this mission
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());

        handleAddWaypoint(makeMutableState(), { location: coord(41.0, -71.995) } as any);

        expect(missionSet.getMission(missionID).getWaypoints().length).toBe(2);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "restoreWaypoints", missions: [{ missionID, waypoints: priorWaypoints }] },
        ]);

        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });
});

describe("handleMoveWaypoint — revert-list construction", () => {
    test("moving a waypoint into a new crossing stages a restoreWaypoints revert; cancel restores the prior location", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        // Zone sits beyond the mission's current route, so no crossing exists yet.
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -71.0));
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());
        jaiaGlobal.setSelectedWaypoint({ missionID, waypointNum: 2, isMoveable: false });

        handleMoveWaypoint(makeMutableState(), { location: coord(41.0, -70.995) } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "restoreWaypoints", missions: [{ missionID, waypoints: priorWaypoints }] },
        ]);

        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });
});

describe("handleDeleteWaypoint — reroute-on-delete revert-list construction", () => {
    test("deleting a waypoint that changes the required detour re-detects and stages a restoreWaypoints revert covering the full prior (bypassed) route", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const missionID = addMission([
            [41.0, -72.02], // P1 — well clear of the zone
            [41.0, -72.005], // P2 — crosses the zone together with P3
            [41.0, -71.995], // P3
        ]);

        // Simulate an already-confirmed reroute: the mission now carries bypass waypoints
        // detouring P2 around the zone on its way to P3.
        const initialPending = detectMissionReroutes();
        expect(initialPending).not.toBeNull();
        const confirmedWaypoints = initialPending!.proposals[0].newWaypoints;
        missionSet.getMission(missionID).setWaypoints(confirmedWaypoints);
        const fullPriorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());

        // Delete P2 (always waypointNum 2 — bypass waypoints only ever land after it).
        // The remaining clean route runs directly from P1 to P3 instead, which still
        // crosses the same zone but needs a differently-shaped detour than P2->P3 did.
        jaiaGlobal.setSelectedWaypoint({ missionID, waypointNum: 2, isMoveable: false });
        handleDeleteWaypoint(makeMutableState());

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toEqual([
            { kind: "restoreWaypoints", missions: [{ missionID, waypoints: fullPriorWaypoints }] },
        ]);

        handleCancelMissionReroute(makeMutableState());

        // Cancelling restores not just P2, but the entire pre-delete route, bypass included.
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(fullPriorWaypoints);
    });
});

describe("handleChangeGridPlanningState(APPROVED) — revert-list construction", () => {
    test("approving a grid plan whose route crosses a zone stages a restoreMissionSnapshot revert; cancel restores the prior mission set", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const mission = new Mission();
        mission.addWaypoint(coord(41.0, -72.005));
        mission.addWaypoint(coord(41.0, -71.995));
        gridPlan.setMissions(new Map([[1, mission]]));

        expect(missionSet.getMissions().size).toBe(0);

        handleChangeGridPlanningState(makeMutableState(), {
            gridPlanningState: GridPlanningStates.APPROVED,
        } as any);

        expect(missionSet.getMissions().size).toBe(1);
        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(pending!.type === "reroute" && pending.data.revert).toHaveLength(1);
        expect(pending!.type === "reroute" && pending.data.revert[0].kind).toBe(
            "restoreMissionSnapshot",
        );

        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMissions().size).toBe(0);
    });
});

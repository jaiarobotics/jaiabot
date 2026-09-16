import cloneDeep from "lodash/cloneDeep";

import {
    handleConfirmMissionReroute,
    handleCancelMissionReroute,
    handleConfirmWaypointRemoval,
    handleCancelWaypointRemoval,
    handleClearPlacementError,
} from "../obstacle-avoidance-handlers";
import { handleLoadMissionSet } from "../mission-handlers";
import { missionSet } from "../../../data/mission_set/mission-set";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { obstacleAvoidanceData } from "../../../data/obstacle_avoidance_data/obstacle-avoidance-data";
import Mission from "../../../data/mission_set/mission";
import Waypoint from "../../../data/waypoints/waypoint";
import { MAX_WAYPOINTS, UNASSIGNED_ID } from "../../../utils/constants";
import {
    PendingRerouteProposal,
    PendingWaypointRemovalProposal,
    ProposalStatus,
    RevertContext,
} from "../../../data/obstacle_avoidance_data/pending-route-data";
import { makeMutableState, resetHandlerSingletons, coord, squareZone } from "./handler-test-utils";

function addMission(waypoints: [number, number][]): number {
    const mission = new Mission();
    for (const [lat, lon] of waypoints) mission.addWaypoint(coord(lat, lon));
    return missionSet.addMission(mission);
}

beforeEach(resetHandlerSingletons);

describe("handleConfirmMissionReroute", () => {
    test("applies a FEASIBLE proposal's newWaypoints to its mission and clears the pending change", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const newWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());
        newWaypoints[0].setIsBypass(true);
        const proposal: PendingRerouteProposal = {
            missionID,
            newWaypoints,
            bypassCount: 1,
            involvedZoneIDs: [],
            status: ProposalStatus.FEASIBLE,
        };
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [proposal], totalBypassCount: 1, revert: [] },
        });

        handleConfirmMissionReroute(makeMutableState());

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(newWaypoints);
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });

    test.each([
        ["OVER_LIMIT", ProposalStatus.OVER_LIMIT],
        ["IMPOSSIBLE", ProposalStatus.IMPOSSIBLE],
    ])("keeps the mission and its route for a(n) %s proposal", (_label, status) => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());
        const proposal: PendingRerouteProposal = {
            missionID,
            newWaypoints: [],
            bypassCount: 0,
            involvedZoneIDs: [],
            status: status as ProposalStatus,
        };
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [proposal], totalBypassCount: 0, revert: [] },
        });

        handleConfirmMissionReroute(makeMutableState());

        // Flying a route that crosses a zone is the operator's decision; the proposal's
        // waypoints are not an improvement, so nothing is applied.
        expect(missionSet.getMission(missionID)).toBeDefined();
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });

    test("keeps the bot assignment of an unroutable mission", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const botID = 7;
        missionsManager.assign(botID, missionID);
        expect(missionsManager.getBotID(missionID)).toBe(botID);

        const proposal: PendingRerouteProposal = {
            missionID,
            newWaypoints: [],
            bypassCount: 0,
            involvedZoneIDs: [],
            status: ProposalStatus.OVER_LIMIT,
        };
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [proposal], totalBypassCount: 0, revert: [] },
        });

        handleConfirmMissionReroute(makeMutableState());

        expect(missionSet.getMission(missionID)).toBeDefined();
        expect(missionsManager.getBotID(missionID)).toBe(botID);
        expect(missionsManager.getMissionID(botID)).toBe(missionID);
    });

    test("is a no-op when the pending change is not a reroute", () => {
        obstacleAvoidanceData.setPendingChange({ type: "placementError", message: "x" });
        const before = obstacleAvoidanceData.getPendingChange();

        handleConfirmMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getPendingChange()).toBe(before);
    });
});

describe("handleCancelMissionReroute / applyRevert", () => {
    test("clears the pending change even when nothing is pending", () => {
        obstacleAvoidanceData.setPendingChange(null);
        const result = handleCancelMissionReroute(makeMutableState());
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
        expect(result).toBeDefined();
    });

    test("deleteZone revert removes the zone that triggered the dialog", () => {
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const revert: RevertContext[] = [{ kind: "deleteZone", zoneID }];
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [], totalBypassCount: 0, revert },
        });

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toBeUndefined();
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });

    test("restoreZoneShape revert restores the zone's prior vertices", () => {
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const priorZone = cloneDeep(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID));
        obstacleAvoidanceData.getExclusionZoneSet().moveVertex(zoneID, 0, coord(50.0, -80.0));
        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).not.toEqual(priorZone);

        const revert: RevertContext[] = [{ kind: "restoreZoneShape", zoneID, zone: priorZone }];
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [], totalBypassCount: 0, revert },
        });

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toEqual(priorZone);
    });

    test("restoreWaypoints revert restores a mission's prior waypoints", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());
        missionSet.getMission(missionID).setWaypoints([]);
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual([]);

        const revert: RevertContext[] = [
            { kind: "restoreWaypoints", missions: [{ missionID, waypoints: priorWaypoints }] },
        ];
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [], totalBypassCount: 0, revert },
        });

        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });

    test("restoreMissionSnapshot revert restores both missionSet and missionsManager", () => {
        const missionID = addMission([[41.0, -72.005]]);
        missionsManager.assign(3, missionID);
        const missionSetSnapshot = missionSet.captureSnapshot();
        const missionsManagerSnapshot = missionsManager.captureSnapshot();

        // Simulate further mutation (e.g. a duplicate) that needs to be undone.
        const secondMissionID = addMission([[42.0, -73.0]]);
        missionsManager.assign(4, secondMissionID);
        expect(missionSet.getMission(secondMissionID)).toBeDefined();

        const revert: RevertContext[] = [
            {
                kind: "restoreMissionSnapshot",
                missionSet: missionSetSnapshot,
                missionsManager: missionsManagerSnapshot,
            },
        ];
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [], totalBypassCount: 0, revert },
        });

        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMission(secondMissionID)).toBeUndefined();
        expect(missionSet.getMission(missionID)).toBeDefined();
        expect(missionsManager.getBotID(missionID)).toBe(3);
    });

    test("restoreZoneSetSnapshot revert restores the entire zone set", () => {
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const zoneSetSnapshot = obstacleAvoidanceData.getExclusionZoneSet().captureSnapshot();

        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(50.0, -80.0));
        expect(obstacleAvoidanceData.getExclusionZoneSet().getZones().size).toBe(2);

        const revert: RevertContext[] = [
            { kind: "restoreZoneSetSnapshot", zoneSet: zoneSetSnapshot },
        ];
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [], totalBypassCount: 0, revert },
        });

        handleCancelMissionReroute(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().captureSnapshot()).toEqual(
            zoneSetSnapshot,
        );
    });

    test("applies multiple revert actions in order (restoreWaypoints then deleteZone)", () => {
        const missionID = addMission([
            [41.0, -72.005],
            [41.0, -71.995],
        ]);
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        missionSet.getMission(missionID).setWaypoints([]);

        const revert: RevertContext[] = [
            { kind: "restoreWaypoints", missions: [{ missionID, waypoints: priorWaypoints }] },
            { kind: "deleteZone", zoneID },
        ];
        obstacleAvoidanceData.setPendingChange({
            type: "reroute",
            data: { proposals: [], totalBypassCount: 0, revert },
        });

        handleCancelMissionReroute(makeMutableState());

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toBeUndefined();
    });
});

describe("handleConfirmWaypointRemoval", () => {
    test("leaves a mission whose every waypoint falls inside a zone untouched", () => {
        const missionID = addMission([
            [41.0, -72.0],
            [41.0, -71.999],
        ]);
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());
        const proposal: PendingWaypointRemovalProposal = {
            missionID,
            newWaypoints: [],
            removedCount: 2,
            isGutted: true,
        };
        obstacleAvoidanceData.setPendingChange({
            type: "waypointRemoval",
            data: {
                proposals: [proposal],
                totalRemovedCount: 2,
                offendingZoneIDs: [],
                revert: [],
            },
        });

        handleConfirmWaypointRemoval(makeMutableState());

        // Emptying the mission would leave it indistinguishable from a newly created one,
        // silently discarding the operator's route.
        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(priorWaypoints);
    });

    test("applies each proposal's newWaypoints to its mission", () => {
        const missionID = addMission([
            [41.0, -72.0],
            [42.0, -73.0],
        ]);
        const kept = [cloneDeep(missionSet.getMission(missionID).getWaypoints()[1])];
        const proposal: PendingWaypointRemovalProposal = {
            missionID,
            newWaypoints: kept,
            removedCount: 1,
            isGutted: false,
        };
        obstacleAvoidanceData.setPendingChange({
            type: "waypointRemoval",
            data: {
                proposals: [proposal],
                totalRemovedCount: 1,
                offendingZoneIDs: [],
                revert: [],
            },
        });

        handleConfirmWaypointRemoval(makeMutableState());

        expect(missionSet.getMission(missionID).getWaypoints()).toEqual(kept);
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });

    test("also applies a feasible follow-up reroute in the same operation", () => {
        const removalMissionID = addMission([
            [41.0, -72.0],
            [42.0, -73.0],
        ]);
        const rerouteMissionID = addMission([[43.0, -74.0]]);
        const kept = [cloneDeep(missionSet.getMission(removalMissionID).getWaypoints()[1])];
        const removalProposal: PendingWaypointRemovalProposal = {
            missionID: removalMissionID,
            newWaypoints: kept,
            removedCount: 1,
            isGutted: false,
        };
        const rerouteWaypoints = cloneDeep(missionSet.getMission(rerouteMissionID).getWaypoints());
        rerouteWaypoints.push(new Waypoint());
        rerouteWaypoints[1].setLocation(coord(43.0, -74.001));
        const rerouteProposal: PendingRerouteProposal = {
            missionID: rerouteMissionID,
            newWaypoints: rerouteWaypoints,
            bypassCount: 1,
            involvedZoneIDs: [],
            status: ProposalStatus.FEASIBLE,
        };
        obstacleAvoidanceData.setPendingChange({
            type: "waypointRemoval",
            data: {
                proposals: [removalProposal],
                totalRemovedCount: 1,
                offendingZoneIDs: [],
                revert: [],
                followUpReroute: {
                    proposals: [rerouteProposal],
                    totalBypassCount: 1,
                },
            },
        });

        handleConfirmWaypointRemoval(makeMutableState());

        expect(missionSet.getMission(removalMissionID).getWaypoints()).toEqual(kept);
        expect(missionSet.getMission(rerouteMissionID).getWaypoints()).toEqual(rerouteWaypoints);
    });

    test("keeps missions whose follow-up reroute is unroutable, along with their bot assignment", () => {
        const missionID = addMission([[41.0, -72.0]]);
        const botID = 5;
        missionsManager.assign(botID, missionID);
        const rerouteProposal: PendingRerouteProposal = {
            missionID,
            newWaypoints: [],
            bypassCount: 0,
            involvedZoneIDs: [],
            status: ProposalStatus.IMPOSSIBLE,
        };
        obstacleAvoidanceData.setPendingChange({
            type: "waypointRemoval",
            data: {
                proposals: [],
                totalRemovedCount: 0,
                offendingZoneIDs: [],
                revert: [],
                followUpReroute: { proposals: [rerouteProposal], totalBypassCount: 0 },
            },
        });

        handleConfirmWaypointRemoval(makeMutableState());

        expect(missionSet.getMission(missionID)).toBeDefined();
        expect(missionsManager.getMissionID(botID)).toBe(missionID);
    });

    test("is a no-op when the pending change is not a waypointRemoval", () => {
        obstacleAvoidanceData.setPendingChange(null);
        const result = handleConfirmWaypointRemoval(makeMutableState());
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
        expect(result).toBeDefined();
    });
});

describe("handleCancelWaypointRemoval", () => {
    test("clears the pending change and applies its revert list", () => {
        const zoneID = obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0));
        const priorZone = cloneDeep(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID));
        obstacleAvoidanceData.getExclusionZoneSet().moveVertex(zoneID, 0, coord(50.0, -80.0));

        const revert: RevertContext[] = [{ kind: "restoreZoneShape", zoneID, zone: priorZone }];
        obstacleAvoidanceData.setPendingChange({
            type: "waypointRemoval",
            data: { proposals: [], totalRemovedCount: 0, offendingZoneIDs: [], revert },
        });

        handleCancelWaypointRemoval(makeMutableState());

        expect(obstacleAvoidanceData.getExclusionZoneSet().getZone(zoneID)).toEqual(priorZone);
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });

    test("clears the pending change even when the type is not waypointRemoval", () => {
        obstacleAvoidanceData.setPendingChange({ type: "placementError", message: "x" });
        handleCancelWaypointRemoval(makeMutableState());
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });
});

describe("handleClearPlacementError", () => {
    test("clears the pending change", () => {
        obstacleAvoidanceData.setPendingChange({ type: "placementError", message: "x" });
        handleClearPlacementError(makeMutableState());
        expect(obstacleAvoidanceData.getPendingChange()).toBeNull();
    });
});

describe("loading a mission set that conflicts with the zones", () => {
    /** Captures the current mission set, then clears it, so it can be loaded back. */
    function snapshotAndClear() {
        const snapshot = missionSet.captureSnapshot();
        missionSet.deleteAllMissions();
        return snapshot;
    }

    test("keeps every mission when a zone covers all of their waypoints", () => {
        const missionID = addMission([
            [41.0, -72.0005],
            [41.0, -71.9995],
        ]);
        const priorWaypoints = cloneDeep(missionSet.getMission(missionID).getWaypoints());
        const snapshot = snapshotAndClear();
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0, 0.002));

        handleLoadMissionSet(makeMutableState(), { missionSetSnapshot: snapshot } as any);

        expect(obstacleAvoidanceData.getPendingChange()?.type).toBe("waypointRemoval");
        expect(missionSet.getMissions().size).toBe(1);

        handleConfirmWaypointRemoval(makeMutableState());

        // The load is never withheld and confirming never empties the mission — the
        // operator decides what to do about the conflict.
        const loaded = Array.from(missionSet.getMissions().values())[0];
        expect(loaded.getWaypoints().map((wp) => wp.getLocation())).toEqual(
            priorWaypoints.map((wp) => wp.getLocation()),
        );
    });

    test("reports an unroutable mission without withholding it from the load", () => {
        // A full-length line of waypoints: any detour pushes it past MAX_WAYPOINTS, so the
        // mission is reported unroutable rather than merely needing a detour.
        const waypoints: [number, number][] = [];
        for (let i = 0; i < MAX_WAYPOINTS; i++) waypoints.push([41.0, -72.1 + i * 0.001]);
        const missionID = addMission(waypoints);
        const priorCount = missionSet.getMission(missionID).getWaypoints().length;
        const snapshot = snapshotAndClear();
        // Sits in the gap between two consecutive waypoints, blocking that leg only.
        obstacleAvoidanceData.getExclusionZoneSet().addZone(squareZone(41.0, -72.0605, 0.0002));

        handleLoadMissionSet(makeMutableState(), { missionSetSnapshot: snapshot } as any);

        const pending = obstacleAvoidanceData.getPendingChange();
        expect(pending?.type).toBe("reroute");
        expect(
            pending?.type === "reroute" && pending.data.proposals.map((p) => p.status),
        ).toContain(ProposalStatus.OVER_LIMIT);
        expect(missionSet.getMissions().size).toBe(1);

        handleConfirmMissionReroute(makeMutableState());

        const loaded = Array.from(missionSet.getMissions().values())[0];
        expect(loaded.getWaypoints()).toHaveLength(priorCount);
    });
});

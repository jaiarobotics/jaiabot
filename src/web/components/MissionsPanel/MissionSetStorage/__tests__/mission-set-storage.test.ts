import Mission from "../../../../data/mission_set/mission";
import { missionSet, MISSION_SET_VERSION } from "../../../../data/mission_set/mission-set";
import { missionA, missionB, missionC } from "../../../../data/tests/__mocks__/mission-mock";
import {
    locationA,
    locationB,
    locationC,
    locationD,
} from "../../../../data/tests/__mocks__/waypoint-mock";
import Task from "../../../../data/tasks/task";
import { TaskType } from "../../../../types/protobuf-types";
import { TaskParameterKeys } from "../../../../types/jaia-system-types";
import {
    saveToHub,
    deleteFromHub,
    listSavedMissionSetsFromHub,
    loadSnapshotFromHub,
    LoadResultType,
    loadSnapshotFromFile,
} from "../mission-set-storage";
import { UNASSIGNED_ID } from "../../../../utils/constants";

jest.mock("../../../../utils/jaia-api", () => ({
    jaiaAPI: {
        listMissionSets: jest.fn(),
        saveMissionSet: jest.fn(),
        loadMissionSet: jest.fn(),
        deleteMissionSet: jest.fn(),
    },
}));

import { jaiaAPI } from "../../../../utils/jaia-api";

const mockJaiaAPI = jaiaAPI as jest.Mocked<typeof jaiaAPI>;

describe("Exercise functions to save and load missions from the hub", () => {
    // In memory fake hub storage to test against
    let fakeHubStorage: Record<string, any> = {};

    beforeEach(() => {
        missionSet.deleteAllMissions();
        fakeHubStorage = {};
        jest.clearAllMocks();
        mockJaiaAPI.listMissionSets.mockImplementation(async () =>
            Object.keys(fakeHubStorage).sort((a, b) => a.localeCompare(b)),
        );
        mockJaiaAPI.saveMissionSet.mockImplementation(async (name: string, snapshot: any) => {
            fakeHubStorage[name] = snapshot;
        });
        mockJaiaAPI.loadMissionSet.mockImplementation(
            async (name: string) => fakeHubStorage[name] ?? null,
        );
        mockJaiaAPI.deleteMissionSet.mockImplementation(async (name: string) => {
            delete fakeHubStorage[name];
        });
    });

    test("Save and retrieve a mission set from the hub", async () => {
        // Create test mission set
        let mission1 = new Mission();
        mission1.addWaypoint(locationA);
        let waypoint1 = mission1.getWaypoint(1);
        let task1 = new Task();
        task1.setType(TaskType.DIVE);
        task1.setParameter({ key: TaskParameterKeys.MAX_DEPTH, value: 13 });
        waypoint1.setTask(task1);
        mission1.addWaypoint(locationB);

        let mission2 = new Mission();
        mission2.addWaypoint(locationC);
        let waypoint2 = mission2.getWaypoint(1);
        let task2 = new Task();
        task2.setType(TaskType.STATION_KEEP);
        waypoint2.setTask(task2);
        mission2.addWaypoint(locationD);

        const mission1ID = missionSet.addMission(mission1);
        expect(mission1ID).toEqual(1);
        expect(missionSet.getMissions().size).toEqual(1);

        const mission2ID = missionSet.addMission(mission2);
        expect(mission2ID).toEqual(2);
        expect(missionSet.getMissions().size).toEqual(2);

        // Save the mission set to the hub
        await saveToHub("Test-Mission-Set");

        // Retrieve the serialized mission set from the hub
        const loadResult = await loadSnapshotFromHub("Test-Mission-Set");
        expect(loadResult.resultType).toBe(LoadResultType.CURRENT_FORMAT);

        // Update the mission set data
        missionSet.restoreFromSnapshot(loadResult.snapshot!);

        // Verfiy we got what we expected
        expect(missionSet.getMissions().size).toEqual(2);
        expect(missionSet.getNextMissionID()).toEqual(3);
        expect(missionSet.getName()).toEqual("Test-Mission-Set");

        // Verify the 1st mission
        let retrievedMission1 = missionSet.getMission(1);
        expect(retrievedMission1.getMissionID()).toEqual(1);
        expect(retrievedMission1.getWaypoint(1).getLocation().lat).toEqual(locationA.lat);
        expect(retrievedMission1.getWaypoint(1).getLocation().lon).toEqual(locationA.lon);
        expect(retrievedMission1.getWaypoint(1).getTask().getType()).toEqual(TaskType.DIVE);
        expect(retrievedMission1.getWaypoint(1).getTask().getDiveParameters().max_depth).toEqual(
            13,
        );
        expect(retrievedMission1.getWaypoint(2).getLocation().lat).toEqual(locationB.lat);
        expect(retrievedMission1.getWaypoint(2).getLocation().lon).toEqual(locationB.lon);
        expect(retrievedMission1.getWaypoint(3)).toBeUndefined();

        let retrievedMission2 = missionSet.getMission(2);
        expect(retrievedMission2.getMissionID()).toEqual(2);
        expect(retrievedMission2.getWaypoint(1).getLocation().lat).toEqual(locationC.lat);
        expect(retrievedMission2.getWaypoint(1).getLocation().lon).toEqual(locationC.lon);
        expect(retrievedMission2.getWaypoint(1).getTask().getType()).toEqual(TaskType.STATION_KEEP);
        expect(retrievedMission2.getWaypoint(2).getLocation().lat).toEqual(locationD.lat);
        expect(retrievedMission2.getWaypoint(2).getLocation().lon).toEqual(locationD.lon);
    });

    test("Save multiple missions sets, list them, and delete them", async () => {
        // Verify there are no saved missions sets
        expect((await listSavedMissionSetsFromHub()).length).toEqual(0);

        // Create a mission set and save it to the hub
        missionSet.addMission(missionA);
        missionSet.addMission(missionB);
        expect(missionSet.getMissions().size).toEqual(2);
        await saveToHub("Test-Mission-Set-A");

        let names = await listSavedMissionSetsFromHub();
        // Verify we got what we expected
        expect(names.length).toEqual(1);
        expect(names[0]).toEqual("Test-Mission-Set-A");
        expect(missionSet.getName()).toEqual("Test-Mission-Set-A");

        // Create another mission set and save it
        missionSet.deleteAllMissions();
        missionSet.addMission(missionC);
        expect(missionSet.getMissions().size).toEqual(1);
        await saveToHub("Test-Mission-Set-B");

        names = await listSavedMissionSetsFromHub();
        // Verify we got what we expected
        expect(names.length).toEqual(2);
        expect(names[0]).toEqual("Test-Mission-Set-A");
        expect(names[1]).toEqual("Test-Mission-Set-B");

        // Retrieve the first mission set from the hub
        const loadResultA = await loadSnapshotFromHub("Test-Mission-Set-A");

        // Update the mission set data
        missionSet.restoreFromSnapshot(loadResultA.snapshot!);

        expect(missionSet.getMissions().size).toEqual(2);

        // Delete the first set from the hub
        await deleteFromHub("Test-Mission-Set-A");
        names = await listSavedMissionSetsFromHub();
        expect(names.length).toEqual(1);
        expect(names[0]).toEqual("Test-Mission-Set-B");

        // Save another mission set and verify saved list is sorted
        missionSet.deleteAllMissions();
        missionSet.addMission(missionC);
        expect(missionSet.getMissions().size).toEqual(1);
        await saveToHub("Test-Mission-Set-A");

        names = await listSavedMissionSetsFromHub();
        // Verify we got what we expected
        expect(names.length).toEqual(2);
        expect(names[0]).toEqual("Test-Mission-Set-A");
        expect(names[1]).toEqual("Test-Mission-Set-B");

        // Try to delete a mission set that is not saved
        await deleteFromHub("Test-Mission-Set-C");
        names = await listSavedMissionSetsFromHub();
        expect(names.length).toEqual(2);

        // Try to retrieve a mission set that is not saved
        const missingResult = await loadSnapshotFromHub("Test-Mission-Set");
        expect(missingResult.snapshot).toBeNull();
    });

    test("Migrate 2.0 hub: bottomDepthSafetyParams moves into segments[0]", async () => {
        const srp = { max_safety_depth: 10, safety_depth_heading: 180 };
        const v20MissionSets = {
            "Old-Set": {
                name: "Old-Set",
                nextMissionID: 2,
                missionIDInEditMode: UNASSIGNED_ID,
                missionSpeeds: { transit: 2, stationkeep_outer: 2 },
                missions: [
                    [
                        1,
                        {
                            waypoints: [{ location: locationA }],
                            bottomDepthSafetyParams: srp,
                        },
                    ],
                ],
                // no version field — treated as 2.0
            },
        };
        fakeHubStorage["Old-Set"] = v20MissionSets["Old-Set"];

        const loadResult = await loadSnapshotFromHub("Old-Set");
        expect(loadResult.resultType).toBe(LoadResultType.OLD_FORMAT);

        expect(loadResult.snapshot!.missions.length).toBe(1);
        const [, mission] = loadResult.snapshot!.missions[0];
        expect(mission.getBottomDepthSafetyParams()).toEqual(srp);
        expect(mission.getSegments()[0].bottom_depth_safety_params).toEqual(srp);
    });

    test("Migrate 2.0 hub: snapshot-level missionSpeeds stamped onto missions without speeds", async () => {
        const speeds = { transit: 3, stationkeep_outer: 2 };
        const v20MissionSets = {
            "Old-Set": {
                name: "Old-Set",
                nextMissionID: 2,
                missionIDInEditMode: UNASSIGNED_ID,
                missionSpeeds: speeds,
                missions: [
                    [1, { waypoints: [{ location: locationA }] }],
                    [
                        2,
                        {
                            waypoints: [{ location: locationB }],
                            speeds: { transit: 1, stationkeep_outer: 1 },
                        },
                    ],
                ],
                // no version field — treated as 2.0
            },
        };
        fakeHubStorage["Old-Set"] = v20MissionSets["Old-Set"];

        const loadResult = await loadSnapshotFromHub("Old-Set");
        expect(loadResult.resultType).toBe(LoadResultType.OLD_FORMAT);

        const [, mission1] = loadResult.snapshot!.missions[0];
        expect(mission1.getTransitSpeed()).toBe(speeds.transit);
        expect(mission1.getStationkeepSpeed()).toBe(speeds.stationkeep_outer);

        // Mission that already has speeds should keep its own
        const [, mission2] = loadResult.snapshot!.missions[1];
        expect(mission2.getTransitSpeed()).toBe(1);
        expect(mission2.getStationkeepSpeed()).toBe(1);
    });

    test("loadSnapshotFromFile returns OLD_FORMAT for version 2.0 file", async () => {
        const fileContent = JSON.stringify({
            version: "2.0",
            snapshot: {
                name: "File-Set",
                nextMissionID: 2,
                missionIDInEditMode: UNASSIGNED_ID,
                missionSpeeds: { transit: 2, stationkeep_outer: 2 },
                missions: [[1, { waypoints: [{ location: locationC }] }]],
            },
        });
        const file = new File([fileContent], "file-set.json", { type: "application/json" });
        // jsdom may not implement File.prototype.text — mock it directly on the instance
        (file as any).text = () => Promise.resolve(fileContent);

        // Simulate file input selection
        const mockInput = document.createElement("input");
        jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput);

        const resultPromise = loadSnapshotFromFile();
        // Trigger the onchange handler with the mock file
        Object.defineProperty(mockInput, "files", { value: [file] });
        mockInput.dispatchEvent(new Event("change"));

        const result = await resultPromise;
        expect(result.resultType).toBe(LoadResultType.OLD_FORMAT);
        expect(result.snapshot).not.toBeNull();
        expect(result.snapshot!.missions.length).toBe(1);
    });

    test("loadSnapshotFromFile returns CURRENT_FORMAT for current version file", async () => {
        const fileContent = JSON.stringify({
            version: MISSION_SET_VERSION,
            snapshot: {
                name: "Current-Set",
                nextMissionID: 2,
                missionIDInEditMode: UNASSIGNED_ID,
                missionSpeeds: { transit: 2, stationkeep_outer: 2 },
                missions: [
                    [
                        1,
                        {
                            waypoints: [{ location: locationD }],
                            segments: [{ start_goal_index: 1 }],
                        },
                    ],
                ],
            },
        });
        const file = new File([fileContent], "current-set.json", { type: "application/json" });
        (file as any).text = () => Promise.resolve(fileContent);

        const mockInput = document.createElement("input");
        jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput);

        const resultPromise = loadSnapshotFromFile();
        Object.defineProperty(mockInput, "files", { value: [file] });
        mockInput.dispatchEvent(new Event("change"));

        const result = await resultPromise;
        expect(result.resultType).toBe(LoadResultType.CURRENT_FORMAT);
        expect(result.snapshot).not.toBeNull();
        expect(result.snapshot!.missions.length).toBe(1);
    });
});

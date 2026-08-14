import Mission from "../../../../data/mission_set/mission";
import { missionSet } from "../../../../data/mission_set/mission-set";
import { missionA, missionB, missionC } from "../../../../data/tests/__mocks__/mission-mock";
import {
    locationA,
    locationB,
    locationC,
    locationD,
} from "../../../../data/tests/__mocks__/waypoint-mock";
import Task from "../../../../data/tasks/task";
import { MissionTask_TaskType } from "../../../../shared/proto/jaiabot/messages/mission";
import { TaskParameterKeys } from "../../../../types/jaia-system-types";
import {
    saveToLocalStorage,
    deleteFromLocalStorage,
    listSavedMissionSets,
    loadSnapshotFromLocalStorage,
} from "../mission-set-storage";
import { UNASSIGNED_ID } from "../../../../utils/constants";

describe("Exercise functions to save and load missions from localStorage", () => {
    beforeEach(() => {
        missionSet.deleteAllMissions();
        localStorage.clear();
    });
    test("Save and retrieve a mission set from localStorage", () => {
        // Create test mission set
        let mission1 = new Mission();
        mission1.addWaypoint(locationA);
        let waypoint1 = mission1.getWaypoint(1);
        let task1 = new Task();
        task1.setType(MissionTask_TaskType.DIVE);
        task1.setParameter({ key: TaskParameterKeys.MAX_DEPTH, value: 13 });
        waypoint1.setTask(task1);
        mission1.addWaypoint(locationB);

        let mission2 = new Mission();
        mission2.addWaypoint(locationC);
        let waypoint2 = mission2.getWaypoint(1);
        let task2 = new Task();
        task2.setType(MissionTask_TaskType.STATION_KEEP);
        waypoint2.setTask(task2);
        mission2.addWaypoint(locationD);

        const mission1ID = missionSet.addMission(mission1);
        expect(mission1ID).toEqual(1);
        expect(missionSet.getMissions().size).toEqual(1);

        const mission2ID = missionSet.addMission(mission2);
        expect(mission2ID).toEqual(2);
        expect(missionSet.getMissions().size).toEqual(2);

        // Save the mission set to localStorage
        saveToLocalStorage("Test-Mission-Set");

        // Retrieve the serialized mission set from localStorage
        const missionSetSnapshot = loadSnapshotFromLocalStorage("Test-Mission-Set");

        // Update the mission set data
        missionSet.restoreFromSnapshot(missionSetSnapshot);

        // Verfiy we got what we expected
        expect(missionSet.getMissions().size).toEqual(2);
        expect(missionSet.getNextMissionID()).toEqual(3);
        expect(missionSet.getName()).toEqual("Test-Mission-Set");

        // Verify the 1st mission
        let retrievedMission1 = missionSet.getMission(1);
        expect(retrievedMission1.getMissionID()).toEqual(1);
        expect(retrievedMission1.getWaypoint(1).getLocation().lat).toEqual(locationA.lat);
        expect(retrievedMission1.getWaypoint(1).getLocation().lon).toEqual(locationA.lon);
        expect(retrievedMission1.getWaypoint(1).getTask().getType()).toEqual(
            MissionTask_TaskType.DIVE,
        );
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
        expect(retrievedMission2.getWaypoint(1).getTask().getType()).toEqual(
            MissionTask_TaskType.STATION_KEEP,
        );
        expect(retrievedMission2.getWaypoint(2).getLocation().lat).toEqual(locationD.lat);
        expect(retrievedMission2.getWaypoint(2).getLocation().lon).toEqual(locationD.lon);
    });

    test("Save multiple missions sets, list them, and delete them", () => {
        // Verify there are no saved missions sets
        expect(listSavedMissionSets().length).toEqual(0);

        // Create a mission set and save it to localStorage
        missionSet.addMission(missionA);
        missionSet.addMission(missionB);
        expect(missionSet.getMissions().size).toEqual(2);
        saveToLocalStorage("Test-Mission-Set-A");

        // Verify we got what we expected
        expect(listSavedMissionSets().length).toEqual(1);
        expect(listSavedMissionSets()[0]).toEqual("Test-Mission-Set-A");
        expect(missionSet.getName()).toEqual("Test-Mission-Set-A");

        // Create another mission set and save it
        missionSet.deleteAllMissions();
        missionSet.addMission(missionC);
        expect(missionSet.getMissions().size).toEqual(1);
        saveToLocalStorage("Test-Mission-Set-B");

        // Verify we got what we expected
        expect(listSavedMissionSets().length).toEqual(2);
        expect(listSavedMissionSets()[0]).toEqual("Test-Mission-Set-A");
        expect(listSavedMissionSets()[1]).toEqual("Test-Mission-Set-B");

        // Retrieve the first mission set from localStorage
        let missionSetSnapshot = loadSnapshotFromLocalStorage("Test-Mission-Set-A");

        // Update the mission set data
        missionSet.restoreFromSnapshot(missionSetSnapshot);

        expect(missionSet.getMissions().size).toEqual(2);

        // Delete the first set from localStorage
        expect(deleteFromLocalStorage("Test-Mission-Set-A")).toEqual(true);
        expect(listSavedMissionSets().length).toEqual(1);
        expect(listSavedMissionSets()[0]).toEqual("Test-Mission-Set-B");

        // Save another mission set and verify saved list is sorted
        missionSet.deleteAllMissions();
        missionSet.addMission(missionC);
        expect(missionSet.getMissions().size).toEqual(1);
        saveToLocalStorage("Test-Mission-Set-A");

        // Verify we got what we expected
        expect(listSavedMissionSets().length).toEqual(2);
        expect(listSavedMissionSets()[0]).toEqual("Test-Mission-Set-A");
        expect(listSavedMissionSets()[1]).toEqual("Test-Mission-Set-B");

        // Try to delete a mission set that is not saved
        expect(deleteFromLocalStorage("Test-Mission-Set-C")).toEqual(false);

        // Try to retrieve a mission set that is not saved
        missionSetSnapshot = loadSnapshotFromLocalStorage("Test-Mission-Set");
        // Verify defaults
        expect(missionSetSnapshot.missions).toEqual([]);
        expect(missionSetSnapshot.nextMissionID).toBe(0);
        expect(missionSetSnapshot.missionIDInEditMode).toEqual(UNASSIGNED_ID);
        expect(missionSetSnapshot.missionSpeeds).toEqual({});
        expect(missionSetSnapshot.name).toBe("");
    });
});

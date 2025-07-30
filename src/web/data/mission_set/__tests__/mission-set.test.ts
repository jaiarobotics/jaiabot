import Mission from "../mission";
import { missionSet } from "../mission-set";
import {
    missionA,
    missionB,
    missionC,
    missionD,
    missionE,
    missionF,
} from "../../tests/__mocks__/mission-mock";
import { locationA, locationB, locationC, locationD } from "../../tests/__mocks__/waypoint-mock";
import Task from "../../tasks/task";
import { TaskType } from "../../../types/protobuf-types";
import { TaskParameterKeys } from "../../../types/jaia-system-types";

describe("Operator adding and deleting single missions", () => {
    // Running various additions and deletions in single test because jest runs multiple tests in parallel
    test("Operator adding and deleting single missions", () => {
        // Add first mission
        missionSet.addMission(missionA);
        expect(missionSet.getMissions().size).toBe(1);
        expect(missionSet.getMission(1).getMissionID()).toBe(missionA.getMissionID());

        // Add second mission
        missionSet.addMission(missionB);
        expect(missionSet.getMissions().size).toBe(2);
        expect(missionSet.getMission(2).getMissionID()).toBe(missionB.getMissionID());

        // Add third mission
        missionSet.addMission(missionC);
        expect(missionSet.getMissions().size).toBe(3);
        expect(missionSet.getMission(3).getMissionID()).toBe(missionC.getMissionID());

        // Add fourth mission
        missionSet.addMission(missionD);
        expect(missionSet.getMissions().size).toBe(4);
        expect(missionSet.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete first mission
        missionSet.deleteMission(1);
        expect(missionSet.getMissions().size).toBe(3);
        expect(missionSet.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missionSet.getMission(3).getMissionID()).toBe(missionC.getMissionID());
        expect(missionSet.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete middle mission
        missionSet.deleteMission(3);
        expect(missionSet.getMissions().size).toBe(2);
        expect(missionSet.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missionSet.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete last mission
        missionSet.deleteMission(4);
        expect(missionSet.getMissions().size).toBe(1);
        expect(missionSet.getMission(2).getMissionID()).toBe(missionB.getMissionID());

        // Reset missions singleton to clean state
        missionSet.deleteAllMissions();
    });
});

describe("Operator adding and deleting multiple missions at once", () => {
    const missionSet1 = [missionA, missionB, missionC, missionD];
    const missionSet2 = [missionE, missionF];

    // Running various additions and deletions in single test because jest runs multiple tests in parallel
    test("Operator adding and deleting multiple missions at once", () => {
        // Add four missions
        expect(missionSet.getMissions().size).toBe(0);
        missionSet.addMissions(missionSet1);
        expect(missionSet.getMissions().size).toBe(4);
        expect(missionSet.getMission(1).getMissionID()).toBe(missionA.getMissionID());
        expect(missionSet.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missionSet.getMission(3).getMissionID()).toBe(missionC.getMissionID());
        expect(missionSet.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete all missions
        missionSet.deleteAllMissions();
        expect(missionSet.getMissions().size).toBe(0);

        // Append mission set to existing missions
        expect(missionSet.getMissions().size).toBe(0);
        missionSet.addMissions(missionSet1);
        expect(missionSet.getMissions().size).toBe(4);
        missionSet.addMissions(missionSet2);
        expect(missionSet.getMissions().size).toBe(6);
        expect(missionSet.getMission(1).getMissionID()).toBe(missionA.getMissionID());
        expect(missionSet.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missionSet.getMission(3).getMissionID()).toBe(missionC.getMissionID());
        expect(missionSet.getMission(4).getMissionID()).toBe(missionD.getMissionID());
        expect(missionSet.getMission(5).getMissionID()).toBe(missionE.getMissionID());
        expect(missionSet.getMission(6).getMissionID()).toBe(missionF.getMissionID());

        // Reset missions singleton to clean state
        missionSet.deleteAllMissions();
    });
});

describe("Exercise functions to save and load missions from localStorage", () => {
    beforeEach(() => {
        missionSet.deleteAllMissions();
        localStorage.clear();
    });
    test("Save and retrieve a mission", () => {
        // Create test mission
        let originalMission = new Mission();
        originalMission.addWaypoint(locationA);
        let waypoint1 = originalMission.getWaypoint(1);
        let task1 = new Task();
        task1.setType(TaskType.DIVE);
        task1.setParameter({ key: TaskParameterKeys.MAX_DEPTH, value: 13 });
        waypoint1.setTask(task1);
        originalMission.addWaypoint(locationB);

        const originalID: number = missionSet.addMission(originalMission);
        expect(originalID).toEqual(1);
        expect(missionSet.getMissions().size).toEqual(1);

        // Save the mission to localStorage
        missionSet.saveMissionLocalStorage("SavedMission", originalID);
        expect(originalMission.getName()).toEqual("SavedMission");

        // Retrieve mission from localStorage
        missionSet.loadMissionLocalStorage("SavedMission");

        // Verify the retrieved mission is a new copy of the original
        expect(missionSet.getMissions().size).toEqual(2);
        const newMission = missionSet.getMission(2);
        // Verify it is a new reference
        expect(newMission).not.toEqual(originalMission);
        expect(newMission.getName()).toEqual("SavedMission");
        expect(newMission.getMissionID()).toEqual(2);
        expect(newMission.getWaypoint(1).getLocation().lat).toEqual(locationA.lat);
        expect(newMission.getWaypoint(1).getLocation().lon).toEqual(locationA.lon);
        expect(newMission.getWaypoint(1).getTask().getType()).toEqual(TaskType.DIVE);
        expect(newMission.getWaypoint(1).getTask().getDiveParameters().max_depth).toEqual(13);
    });

    test("Save and retrieve a mission set from localStorage", () => {
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

        const mission1Id: number = missionSet.addMission(mission1);
        expect(mission1Id).toEqual(1);
        expect(missionSet.getMissions().size).toEqual(1);

        const mission2Id: number = missionSet.addMission(mission2);
        expect(mission2Id).toEqual(2);
        expect(missionSet.getMissions().size).toEqual(2);

        // Save the mission set to localStorage
        missionSet.saveMissionSet("Test-Mission-Set");

        // Retrieve the mission set from localStorage
        missionSet.loadMissionSet("Test-Mission-Set");

        // Verfiy we got what we expected
        expect(missionSet.getMissions().size).toEqual(2);
        expect(missionSet.getNextMissionID()).toEqual(3);
        expect(missionSet.getName()).toEqual("Test-Mission-Set");

        // Verify the 1st mission
        let retrievedMission1 = missionSet.getMission(1);
        expect(retrievedMission1.getMissionID()).toEqual(1);
        expect(retrievedMission1.getName()).toEqual("Test-Mission-Set");
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
        expect(retrievedMission2.getName()).toEqual("Test-Mission-Set");
        expect(retrievedMission2.getWaypoint(1).getLocation().lat).toEqual(locationC.lat);
        expect(retrievedMission2.getWaypoint(1).getLocation().lon).toEqual(locationC.lon);
        expect(retrievedMission2.getWaypoint(1).getTask().getType()).toEqual(TaskType.STATION_KEEP);
        expect(retrievedMission2.getWaypoint(2).getLocation().lat).toEqual(locationD.lat);
        expect(retrievedMission2.getWaypoint(2).getLocation().lon).toEqual(locationD.lon);
    });

    test("Save Multiple Missions Sets, list them and delete them", () => {
        // Verify there are no saved missions sets
        expect(missionSet.listSavedMissionSets().length).toEqual(0);

        // Create a mission set and save it to localStorage
        missionSet.addMission(missionA);
        missionSet.addMission(missionB);
        expect(missionSet.getMissions().size).toEqual(2);
        missionSet.saveMissionSet("Test-mission-Set-A");
        // Verify we got what we expected
        expect(missionSet.listSavedMissionSets().length).toEqual(1);
        expect(missionSet.listSavedMissionSets()[0]).toEqual("Test-mission-Set-A");
        expect(missionSet.getName()).toEqual("Test-mission-Set-A");
        expect(missionSet.getMission(1).getName()).toEqual("Test-mission-Set-A");

        // Create another mission set and save it
        missionSet.deleteAllMissions();
        missionSet.addMission(missionC);
        expect(missionSet.getMissions().size).toEqual(1);
        missionSet.saveMissionSet("Test-mission-Set-B");
        // Verify we got what we expected
        expect(missionSet.listSavedMissionSets().length).toEqual(2);
        expect(missionSet.listSavedMissionSets()[0]).toEqual("Test-mission-Set-A");
        expect(missionSet.listSavedMissionSets()[1]).toEqual("Test-mission-Set-B");

        // Retrieve first set from localStorage and check local misssions data
        expect(missionSet.loadMissionSet("Test-mission-Set-A")).toEqual(true);
        expect(missionSet.getMissions().size).toEqual(2);
        expect(missionSet.getMission(1).getName()).toEqual("Test-mission-Set-A");

        // Delete the first set from localStorage
        expect(missionSet.deleteMissionSet("Test-mission-Set-A")).toEqual(true);
        expect(missionSet.listSavedMissionSets().length).toEqual(1);
        expect(missionSet.listSavedMissionSets()[0]).toEqual("Test-mission-Set-B");

        // Save another mission set and verify saved list is sorted
        missionSet.deleteAllMissions();
        missionSet.addMission(missionC);
        expect(missionSet.getMissions().size).toEqual(1);
        missionSet.saveMissionSet("Test-mission-Set-A");
        // Verify we got what we expected
        expect(missionSet.listSavedMissionSets().length).toEqual(2);
        expect(missionSet.listSavedMissionSets()[0]).toEqual("Test-mission-Set-A");
        expect(missionSet.listSavedMissionSets()[1]).toEqual("Test-mission-Set-B");

        // Try to delete a mission set that is not saved
        expect(missionSet.deleteMissionSet("Test-mission-Set-C")).toEqual(false);

        // Try to retrieve a mission set that is not saved
        expect(missionSet.loadMissionSet("Test-mission-Set-C")).toEqual(false);
    });
});

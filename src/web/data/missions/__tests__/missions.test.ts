import Mission from "../mission";
import { missions } from "../missions";
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
        missions.addMission(missionA);
        expect(missions.getMissions().size).toBe(1);
        expect(missions.getMission(1).getMissionID()).toBe(missionA.getMissionID());

        // Add second mission
        missions.addMission(missionB);
        expect(missions.getMissions().size).toBe(2);
        expect(missions.getMission(2).getMissionID()).toBe(missionB.getMissionID());

        // Add third mission
        missions.addMission(missionC);
        expect(missions.getMissions().size).toBe(3);
        expect(missions.getMission(3).getMissionID()).toBe(missionC.getMissionID());

        // Add fourth mission
        missions.addMission(missionD);
        expect(missions.getMissions().size).toBe(4);
        expect(missions.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete first mission
        missions.deleteMission(1);
        expect(missions.getMissions().size).toBe(3);
        expect(missions.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missions.getMission(3).getMissionID()).toBe(missionC.getMissionID());
        expect(missions.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete middle mission
        missions.deleteMission(3);
        expect(missions.getMissions().size).toBe(2);
        expect(missions.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missions.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete last mission
        missions.deleteMission(4);
        expect(missions.getMissions().size).toBe(1);
        expect(missions.getMission(2).getMissionID()).toBe(missionB.getMissionID());

        // Reset missions singleton to clean state
        missions.deleteAllMissions();
    });
});

describe("Operator adding and deleting multiple missions at once", () => {
    const missionSet1 = [missionA, missionB, missionC, missionD];
    const missionSet2 = [missionE, missionF];

    // Running various additions and deletions in single test because jest runs multiple tests in parallel
    test("Operator adding and deleting multiple missions at once", () => {
        // Add four missions
        expect(missions.getMissions().size).toBe(0);
        missions.addMissionSet(missionSet1);
        expect(missions.getMissions().size).toBe(4);
        expect(missions.getMission(1).getMissionID()).toBe(missionA.getMissionID());
        expect(missions.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missions.getMission(3).getMissionID()).toBe(missionC.getMissionID());
        expect(missions.getMission(4).getMissionID()).toBe(missionD.getMissionID());

        // Delete all missions
        missions.deleteAllMissions();
        expect(missions.getMissions().size).toBe(0);

        // Append mission set to existing missions
        expect(missions.getMissions().size).toBe(0);
        missions.addMissionSet(missionSet1);
        expect(missions.getMissions().size).toBe(4);
        missions.addMissionSet(missionSet2);
        expect(missions.getMissions().size).toBe(6);
        expect(missions.getMission(1).getMissionID()).toBe(missionA.getMissionID());
        expect(missions.getMission(2).getMissionID()).toBe(missionB.getMissionID());
        expect(missions.getMission(3).getMissionID()).toBe(missionC.getMissionID());
        expect(missions.getMission(4).getMissionID()).toBe(missionD.getMissionID());
        expect(missions.getMission(5).getMissionID()).toBe(missionE.getMissionID());
        expect(missions.getMission(6).getMissionID()).toBe(missionF.getMissionID());

        // Reset missions singleton to clean state
        missions.deleteAllMissions();
    });
});

describe("Exercise functions to save and load missions from localStorage", () => {
    beforeEach(() => {
        missions.deleteAllMissions();
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

        const originalID: number = missions.addMission(originalMission);
        expect(originalID).toEqual(1);
        expect(missions.getMissions().size).toEqual(1);

        // Save the mission to localStorage
        missions.saveMission("SavedMission", originalID);
        expect(originalMission.getSaveName()).toEqual("SavedMission");

        // Retrieve mission from localStorage
        missions.loadMission("SavedMission");

        // Verify the retrieved mission is a new copy of the original
        expect(missions.getMissions().size).toEqual(2);
        const newMission = missions.getMission(2);
        // Verify it is a new reference
        expect(newMission).not.toEqual(originalMission);
        expect(newMission.getSaveName()).toEqual("SavedMission");
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
        task2.setParameter({ key: TaskParameterKeys.HOLD_TIME, value: 4 });
        waypoint2.setTask(task2);
        mission2.addWaypoint(locationD);

        const mission1Id: number = missions.addMission(mission1);
        expect(mission1Id).toEqual(1);
        expect(missions.getMissions().size).toEqual(1);

        const mission2Id: number = missions.addMission(mission2);
        expect(mission2Id).toEqual(2);
        expect(missions.getMissions().size).toEqual(2);

        missions.saveAllMissions("Test-Mission-Set");
    });
});

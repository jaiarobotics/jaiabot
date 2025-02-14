import { missions } from "../missions";
import {
    missionA,
    missionB,
    missionC,
    missionD,
    missionE,
    missionF,
} from "../../tests/__mocks__/mission-mock";

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

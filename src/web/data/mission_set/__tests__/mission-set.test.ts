import { missionSet } from "../mission-set";
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

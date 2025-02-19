import { missionsManager } from "../missions-manager";
import { UNASSIGNED_ID } from "../../../utils/constants";

test("Exercise Bot and mission assignments", () => {
    const botID1 = 1;
    const missionID1 = 1;

    const botID2 = 2;
    const missionID2 = 2;

    const botID3 = 3;

    // Assign Bot 1 to Mission 1
    missionsManager.assign(botID1, missionID1);
    expect(missionsManager.getBotID(missionID1)).toBe(botID1);
    expect(missionsManager.getMissionID(botID1)).toBe(missionID1);

    // Assign Bot 2 to Mission 2
    missionsManager.assign(botID2, missionID2);
    expect(missionsManager.getBotID(missionID2)).toBe(botID2);
    expect(missionsManager.getMissionID(botID2)).toBe(missionID2);

    // Unassign Bot 2 from Mission 2
    missionsManager.assign(UNASSIGNED_ID, missionID2);
    expect(missionsManager.getBotID(missionID2)).toBe(UNASSIGNED_ID);
    expect(missionsManager.getMissionID(botID2)).toBe(UNASSIGNED_ID);

    // Assign Bot 2 to Mission 1
    missionsManager.assign(botID2, missionID1);
    expect(missionsManager.getBotID(missionID1)).toBe(botID2);
    expect(missionsManager.getMissionID(botID2)).toBe(missionID1);

    // Assign Bot 1 to Mission 2
    missionsManager.assign(botID1, missionID2);
    expect(missionsManager.getBotID(missionID2)).toBe(botID1);
    expect(missionsManager.getMissionID(botID1)).toBe(missionID2);

    // Assign Bot 3 to Mission 2
    missionsManager.assign(botID3, missionID2);
    expect(missionsManager.getBotID(missionID2)).toBe(botID3);
    expect(missionsManager.getMissionID(botID3)).toBe(missionID2);
    expect(missionsManager.getMissionID(botID1)).toBe(UNASSIGNED_ID);
});

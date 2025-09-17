import {
    createHistory,
    pushHistory,
    undoHistory,
    redoHistory,
    getPresent,
    peekUndoDescription,
    peekRedoDescription,
    clearHistory,
} from "../mission-history";
import Mission from "../../data/mission_set/mission";
import { MAX_MISSION_HISTORY, UNASSIGNED_ID } from "../constants";

test("exercise histroy buffer", () => {
    // Initialize a history buffer
    let missionHistory = createHistory();
    expect(missionHistory.index).toBe(UNASSIGNED_ID);
    expect(missionHistory.head).toBe(0);
    expect(missionHistory.size).toBe(0);
    expect(getPresent(missionHistory)).toBeUndefined();
    // Verify Undo and Redo on empty history work
    undoHistory(missionHistory);
    expect(missionHistory.size).toBe(0);
    expect(getPresent(missionHistory)).toBeUndefined();
    redoHistory(missionHistory);
    expect(missionHistory.size).toBe(0);
    expect(getPresent(missionHistory)).toBeUndefined();

    // Push a mission onto history buffer
    const mission1 = new Mission();
    mission1.setMissionID(1);
    pushHistory(missionHistory, { mission: mission1, description: "1st push" });
    expect(missionHistory.size).toBe(1);
    expect(missionHistory.head).toBe(0);
    expect(missionHistory.index).toBe(0);

    expect(getPresent(missionHistory).description).toBe("1st push");
    expect(getPresent(missionHistory).mission.getMissionID()).toBe(1);
    expect(peekUndoDescription(missionHistory)).toBe("1st push");
    expect(peekRedoDescription(missionHistory)).toBeUndefined();

    // Push a 2nd mission onto buffer
    const mission2 = new Mission();
    mission2.setMissionID(2);
    pushHistory(missionHistory, { mission: mission2, description: "2nd push" });
    expect(missionHistory.size).toBe(2);
    expect(getPresent(missionHistory).description).toBe("2nd push");
    expect(getPresent(missionHistory).mission.getMissionID()).toBe(2);

    // Use Undo to get 1st mission
    undoHistory(missionHistory);
    expect(missionHistory.size).toBe(2);
    expect(getPresent(missionHistory).description).toBe("1st push");
    expect(getPresent(missionHistory).mission.getMissionID()).toBe(1);
    expect(peekRedoDescription(missionHistory)).toBe("2nd push");

    // Try to Undo too far
    undoHistory(missionHistory);
    expect(missionHistory.size).toBe(2);
    expect(getPresent(missionHistory).description).toBe("1st push");
    expect(getPresent(missionHistory).mission.getMissionID()).toBe(1);

    // Use Redo to get 2nd mission
    redoHistory(missionHistory);
    expect(missionHistory.size).toBe(2);
    expect(getPresent(missionHistory).description).toBe("2nd push");
    expect(getPresent(missionHistory).mission.getMissionID()).toBe(2);
    expect(peekRedoDescription(missionHistory)).toBeUndefined();

    // Try to Redo too far
    redoHistory(missionHistory);
    expect(missionHistory.size).toBe(2);
    expect(getPresent(missionHistory).description).toBe("2nd push");
    expect(getPresent(missionHistory).mission.getMissionID()).toBe(2);
    expect(peekRedoDescription(missionHistory)).toBeUndefined();

    // Fill the history buffer
    clearHistory(missionHistory); // start with an empty history
    for (let i = 1; i <= MAX_MISSION_HISTORY; i++) {
        let mission = new Mission();
        mission.setMissionID(i);
        let desc = "Push " + i;
        pushHistory(missionHistory, { mission: mission, description: desc });
        expect(peekUndoDescription(missionHistory)).toBe("Push " + i);
    }
    expect(missionHistory.size).toBe(MAX_MISSION_HISTORY);
    expect(missionHistory.index).toBe(MAX_MISSION_HISTORY - 1);

    // Push another history entry and verify circular bechavior
    const newMission = new Mission();
    newMission.setMissionID(MAX_MISSION_HISTORY + 1);
    pushHistory(missionHistory, { mission: newMission, description: "Last Push" });
    expect(getPresent(missionHistory).mission.getMissionID()).toBe(MAX_MISSION_HISTORY + 1);
    expect(missionHistory.size).toBe(MAX_MISSION_HISTORY);
    expect(missionHistory.index).toBe(0);
    expect(missionHistory.head).toBe(1);
    expect(peekUndoDescription(missionHistory)).toBe("Last Push");

    // Undo and verify circular behavior
    undoHistory(missionHistory);
    expect(missionHistory.size).toBe(MAX_MISSION_HISTORY);
    expect(missionHistory.index).toBe(MAX_MISSION_HISTORY - 1);
    expect(peekUndoDescription(missionHistory)).toBe("Push " + MAX_MISSION_HISTORY);
    expect(peekRedoDescription(missionHistory)).toBe("Last Push");
});

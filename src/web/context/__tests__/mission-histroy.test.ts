import { getActionDescription } from "../mission-history";
import { JaiaActions } from "../jaia-actions";
test("getActionDescription returns correct descriptions", () => {
    expect(getActionDescription({ type: JaiaActions.ADD_MISSION })).toBe("Add Mission");
    expect(getActionDescription({ type: JaiaActions.DELETE_MISSION, missionID: 3 })).toBe(
        "Delete Mission 3",
    );
    expect(getActionDescription({ type: JaiaActions.DUPLICATE_MISSION, missionID: 5 })).toBe(
        "Duplicate Mission 5",
    );
    expect(getActionDescription({ type: JaiaActions.DELETE_ALL_MISSIONS })).toBe(
        "Delete All Missions",
    );
    expect(getActionDescription({ type: JaiaActions.POLL_DATA_MODEL })).toBe("");
});

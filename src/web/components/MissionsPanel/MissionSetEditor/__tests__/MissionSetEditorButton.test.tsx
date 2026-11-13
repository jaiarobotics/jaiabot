import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionSetEditorButton from "../MissionSetEditorButton";
import {
    JCC_CONTAINER,
    MAX_MISSION_SET_NAME_BYTES,
    UNASSIGNED_ID,
} from "../../../../utils/constants";
import {
    listSavedMissionSetsFromHub,
    loadSnapshotFromHub,
} from "../../MissionSetStorage/mission-set-storage";

jest.mock("../../MissionSetStorage/mission-set-storage");

type User = ReturnType<typeof userEvent.setup>;

beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = `<div id="${JCC_CONTAINER}"></div>`;
    (listSavedMissionSetsFromHub as jest.Mock).mockResolvedValue(["transit"]);
    (loadSnapshotFromHub as jest.Mock).mockResolvedValue({
        snapshot: {
            missions: [],
            nextMissionID: 1,
            missionIDInEditMode: UNASSIGNED_ID,
            name: "transit",
            speeds: { transit: 2, stationkeep_outer: 2 },
        },
    });
});

function combinedList() {
    return screen.getByRole("listbox", { name: "Combined Mission Set" });
}

function nameInput() {
    return screen.getByPlaceholderText("Required");
}

async function openEditor(user: User) {
    await user.click(screen.getByRole("button", { name: "mission-set-editor" }));
    await screen.findByRole("option", { name: "transit" });
}

async function closeEditor(user: User) {
    await user.click(screen.getByRole("button", { name: "Cancel" }));
}

function combinedCount() {
    return within(combinedList()).queryAllByRole("option").length;
}

async function addTransit(user: User) {
    const storedList = screen.getByRole("listbox", { name: "Stored Mission Sets" });
    const transit = within(storedList).getByRole("option", { name: "transit" });
    // Clicking a selected item deselects it
    if (transit.getAttribute("aria-selected") !== "true") await user.click(transit);
    const countBefore = combinedCount();
    await user.click(screen.getByTitle("Add").closest("button")!);
    await waitFor(() => expect(combinedCount()).toBe(countBefore + 1));
}

test("reopening the editor clears the combined list", async () => {
    const user = userEvent.setup();
    render(<MissionSetEditorButton />);
    await openEditor(user);
    await addTransit(user);
    await closeEditor(user);

    await openEditor(user);

    expect(combinedCount()).toBe(0);
});

test("reopening the editor clears the mission set name", async () => {
    const user = userEvent.setup();
    render(<MissionSetEditorButton />);
    await openEditor(user);
    await user.type(nameInput(), "combined");
    await closeEditor(user);

    await openEditor(user);

    expect(nameInput()).toHaveValue("");
});

test("the mission set name stops at the length hubs can share", async () => {
    const user = userEvent.setup();
    render(<MissionSetEditorButton />);
    await openEditor(user);

    await user.type(nameInput(), "n".repeat(MAX_MISSION_SET_NAME_BYTES + 5));

    expect(nameInput()).toHaveValue("n".repeat(MAX_MISSION_SET_NAME_BYTES));
});

test("the mission set name limit counts bytes, not characters", async () => {
    const user = userEvent.setup();
    render(<MissionSetEditorButton />);
    await openEditor(user);

    await user.type(nameInput(), "é".repeat(MAX_MISSION_SET_NAME_BYTES));

    expect(nameInput()).toHaveValue("é".repeat(MAX_MISSION_SET_NAME_BYTES / 2));
});

test("adding a set after reopening the editor loads it from the hub again", async () => {
    const user = userEvent.setup();
    render(<MissionSetEditorButton />);
    await openEditor(user);
    await addTransit(user);
    await closeEditor(user);
    await openEditor(user);

    await addTransit(user);

    expect(loadSnapshotFromHub).toHaveBeenCalledTimes(2);
});

test("adding the same set twice while the editor is open loads it from the hub once", async () => {
    const user = userEvent.setup();
    render(<MissionSetEditorButton />);
    await openEditor(user);
    await addTransit(user);

    await addTransit(user);

    expect(loadSnapshotFromHub).toHaveBeenCalledTimes(1);
});

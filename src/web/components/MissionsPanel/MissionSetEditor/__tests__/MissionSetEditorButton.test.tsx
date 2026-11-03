import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import MissionSetEditorButton from "../MissionSetEditorButton";
import Mission from "../../../../data/mission_set/mission";
import { MissionSetSnapshot } from "../../../../data/mission_set/mission-set";
import { JaiaDispatchContext } from "../../../../context/JaiaContext";
import { JCC_CONTAINER, UNASSIGNED_ID } from "../../../../utils/constants";
import { locationA } from "../../../../data/tests/__mocks__/waypoint-mock";
import {
    listSavedMissionSetsFromHub,
    loadSnapshotFromHub,
    saveSnapshotToHub,
} from "../../MissionSetStorage/mission-set-storage";

jest.mock("../../MissionSetStorage/mission-set-storage", () => ({
    listSavedMissionSetsFromHub: jest.fn(),
    loadSnapshotFromHub: jest.fn(),
    saveSnapshotToHub: jest.fn(),
}));

type User = ReturnType<typeof userEvent.setup>;

// Waypoint count of each mission in each saved set, standing in for the hub's mission-sets directory
const hub = new Map<string, number[]>();

function makeSnapshot(name: string, waypointCounts: number[]): MissionSetSnapshot {
    const missions: [number, Mission][] = waypointCounts.map((count, i) => {
        const mission = new Mission();
        for (let j = 0; j < count; j++) mission.addWaypoint(locationA);
        return [i + 1, mission];
    });
    return {
        missions,
        nextMissionID: missions.length + 1,
        missionIDInEditMode: UNASSIGNED_ID,
        name,
        speeds: { transit: 2, stationkeep_outer: 2 },
    };
}

beforeEach(() => {
    document.body.innerHTML = `<div id="${JCC_CONTAINER}"></div>`;
    hub.clear();
    jest.clearAllMocks();
    (listSavedMissionSetsFromHub as jest.Mock).mockImplementation(async () => [...hub.keys()]);
    (loadSnapshotFromHub as jest.Mock).mockImplementation(async (name: string) => ({
        snapshot: makeSnapshot(name, hub.get(name)!),
    }));
    (saveSnapshotToHub as jest.Mock).mockResolvedValue(undefined);
});

function renderEditorButton() {
    render(
        <JaiaDispatchContext.Provider value={jest.fn()}>
            <MissionSetEditorButton />
        </JaiaDispatchContext.Provider>,
    );
}

async function openEditor(user: User) {
    await user.click(screen.getByRole("button", { name: "mission-set-editor" }));
    await screen.findByRole("heading", { name: "Mission Set Editor" });
}

async function cancelEditor(user: User) {
    await user.click(screen.getByRole("button", { name: "Cancel" }));
}

function combinedNames(): string[] {
    const combined = screen.getByRole("listbox", { name: "Combined Mission Set" });
    return within(combined)
        .queryAllByRole("option")
        .map((option) => option.textContent!);
}

async function addToCombined(user: User, name: string) {
    const stored = screen.getByRole("listbox", { name: "Stored Mission Sets" });
    await user.click(await within(stored).findByText(name));
    await user.click(screen.getByTitle("Add").closest("button")!);
    const combined = screen.getByRole("listbox", { name: "Combined Mission Set" });
    await within(combined).findByText(name);
}

/** Names the combined set, confirms Save and Load, and returns waypoints per output mission. */
async function saveAndLoad(user: User, name: string): Promise<number[]> {
    await user.type(screen.getByPlaceholderText("Required"), name);
    await user.click(screen.getByRole("button", { name: "save-and-load-mission-set" }));
    const confirmButtons = screen.getAllByRole("button", { name: "Save and Load" });
    await user.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(saveSnapshotToHub).toHaveBeenCalled());
    const [savedName, saved] = (saveSnapshotToHub as jest.Mock).mock.calls.at(-1);
    expect(savedName).toBe(name);
    return saved.missions.map(([, m]: [number, Mission]) => m.getWaypoints().length);
}

test("reopening the editor clears the combined list and the name", async () => {
    const user = userEvent.setup();
    hub.set("transit", [2]);
    hub.set("survey", [3, 3, 3]);
    renderEditorButton();

    await openEditor(user);
    await addToCombined(user, "transit");
    await addToCombined(user, "survey");
    await user.type(screen.getByPlaceholderText("Required"), "draft");
    await cancelEditor(user);

    await openEditor(user);
    expect(combinedNames()).toEqual([]);
    expect(screen.getByPlaceholderText("Required")).toHaveValue("");
});

test("reopening the editor lists sets saved to the hub since it was last open", async () => {
    const user = userEvent.setup();
    hub.set("transit", [2]);
    renderEditorButton();

    await openEditor(user);
    await cancelEditor(user);
    hub.set("survey", [3, 3, 3]);

    await openEditor(user);
    const stored = screen.getByRole("listbox", { name: "Stored Mission Sets" });
    expect(await within(stored).findByText("survey")).toBeInTheDocument();
});

test("a set fixed on the hub between opens is combined as fixed, not from an earlier copy", async () => {
    const user = userEvent.setup();
    hub.set("transit", [2, 0, 0]);
    hub.set("survey", [3, 3, 3]);
    renderEditorButton();

    await openEditor(user);
    await addToCombined(user, "transit");
    await cancelEditor(user);

    hub.set("transit", [2, 2, 2]);

    await openEditor(user);
    await addToCombined(user, "transit");
    await addToCombined(user, "survey");
    expect(await saveAndLoad(user, "combined")).toEqual([5, 5, 5]);
    expect(loadSnapshotFromHub).toHaveBeenCalledTimes(3);
});

test("after Save and Load, the next open starts fresh and reloads from the hub", async () => {
    const user = userEvent.setup();
    hub.set("transit", [2]);
    hub.set("survey", [3, 3, 3]);
    renderEditorButton();

    await openEditor(user);
    await addToCombined(user, "transit");
    await addToCombined(user, "survey");
    expect(await saveAndLoad(user, "first")).toEqual([5, 5, 5]);
    expect(screen.queryByRole("heading", { name: "Mission Set Editor" })).not.toBeInTheDocument();

    hub.set("transit", [4]);

    await openEditor(user);
    expect(combinedNames()).toEqual([]);
    await addToCombined(user, "transit");
    await addToCombined(user, "survey");
    expect(await saveAndLoad(user, "second")).toEqual([7, 7, 7]);
});

test("within one open, adding a set twice fetches it from the hub once", async () => {
    const user = userEvent.setup();
    hub.set("transit", [2]);
    renderEditorButton();

    await openEditor(user);
    await addToCombined(user, "transit");
    // transit is still selected in the stored list
    await user.click(screen.getByTitle("Add").closest("button")!);
    await waitFor(() => expect(combinedNames()).toEqual(["transit", "transit"]));

    expect(loadSnapshotFromHub).toHaveBeenCalledTimes(1);
});

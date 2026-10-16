import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import ExportMissionSetButton from "../ExportMissionSetButton";

import { JaiaContext, JaiaDispatchContext } from "../../../../../context/JaiaContext";
import { JaiaActions } from "../../../../../context/jaia-actions";
import { actionConfigs } from "../../../../../context/action-configs";
import { handleChangeMissionSetName } from "../../../../../context/handlers/mission-handlers";
import { handleClickedUndo, saveHistory } from "../../../../../context/handlers/history-handlers";
import {
    makeMutableState,
    resetHandlerSingletons,
} from "../../../../../context/handlers/__tests__/handler-test-utils";
import Mission from "../../../../../data/mission_set/mission";
import { missionSet } from "../../../../../data/mission_set/mission-set";

const { createObjectURL, revokeObjectURL } = URL;
let exportedFile: Blob | undefined;

function readText(file: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
    });
}

async function exportAs(saveName: string) {
    const state = makeMutableState();
    saveHistory(state, JaiaActions.INIT);
    const dispatch = jest.fn();
    render(
        <JaiaContext.Provider value={state}>
            <JaiaDispatchContext.Provider value={dispatch}>
                <ExportMissionSetButton saveName={saveName} />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "export-mission-set" }));
    return { state, dispatch };
}

beforeEach(() => {
    resetHandlerSingletons();
    missionSet.addMission(new Mission());
    missionSet.setName("Original");
    exportedFile = undefined;
    URL.createObjectURL = jest.fn((file: Blob) => {
        exportedFile = file;
        return "blob:mission-set";
    });
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    jest.restoreAllMocks();
});

describe("ExportMissionSetButton", () => {
    test("exports under the typed name and renames the set only through a tracked action", async () => {
        const { dispatch } = await exportAs(" Exported ");

        expect(JSON.parse(await readText(exportedFile!)).snapshot.name).toBe("Exported");
        expect(missionSet.getName()).toBe("Original");
        expect(dispatch).toHaveBeenCalledWith({
            type: JaiaActions.CHANGE_MISSION_SET_NAME,
            missionSetName: "Exported",
        });
        expect(actionConfigs.get(JaiaActions.CHANGE_MISSION_SET_NAME)!.tracked).toBe(true);
    });

    test("keeps the exported name when a later edit is undone", async () => {
        const { state, dispatch } = await exportAs("Exported");
        handleChangeMissionSetName(state, dispatch.mock.lastCall[0]);
        saveHistory(state, JaiaActions.CHANGE_MISSION_SET_NAME);

        missionSet.addMission(new Mission());
        saveHistory(state, JaiaActions.ADD_MISSION);
        handleClickedUndo(state);

        expect(missionSet.getName()).toBe("Exported");
    });

    test("records no rename when exported under the current name", async () => {
        const { dispatch } = await exportAs("Original");

        expect(exportedFile).toBeDefined();
        expect(dispatch).not.toHaveBeenCalled();
    });
});

import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import ExportZoneButton from "../ExportZoneButton";

import { JaiaContext, JaiaDispatchContext } from "../../../../../context/JaiaContext";
import { JaiaActions } from "../../../../../context/jaia-actions";
import { actionConfigs } from "../../../../../context/action-configs";
import { handleChangeExclusionZoneSetName } from "../../../../../context/handlers/exclusion-zone-handlers";
import { handleClickedUndo, saveHistory } from "../../../../../context/handlers/history-handlers";
import {
    makeMutableState,
    resetHandlerSingletons,
    squareZone,
} from "../../../../../context/handlers/__tests__/handler-test-utils";
import { exclusionZoneSet } from "../../../../../data/exclusion_zones/exclusion-zone-set";

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
                <ExportZoneButton saveName={saveName} />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "export-zone-set" }));
    return { state, dispatch };
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
    exclusionZoneSet.setName("Original");
    exportedFile = undefined;
    URL.createObjectURL = jest.fn((file: Blob) => {
        exportedFile = file;
        return "blob:zone-set";
    });
    URL.revokeObjectURL = jest.fn();
    jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    jest.restoreAllMocks();
});

describe("ExportZoneButton", () => {
    test("exports under the typed name and renames the set only through a tracked action", async () => {
        const { dispatch } = await exportAs(" Exported ");

        expect(JSON.parse(await readText(exportedFile!)).snapshot.name).toBe("Exported");
        expect(exclusionZoneSet.getName()).toBe("Original");
        expect(dispatch).toHaveBeenCalledWith({
            type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
            exclusionZoneSetName: "Exported",
        });
        expect(actionConfigs.get(JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME)!.tracked).toBe(true);
    });

    test("keeps the exported name when a later edit is undone", async () => {
        const { state, dispatch } = await exportAs("Exported");
        handleChangeExclusionZoneSetName(state, dispatch.mock.lastCall[0]);
        saveHistory(state, JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME);

        exclusionZoneSet.addZone(squareZone(41.01, -72.0));
        saveHistory(state, JaiaActions.ADD_EXCLUSION_ZONE);
        handleClickedUndo(state);

        expect(exclusionZoneSet.getName()).toBe("Exported");
    });

    test("records no rename when exported under the current name", async () => {
        const { dispatch } = await exportAs("Original");

        expect(exportedFile).toBeDefined();
        expect(dispatch).not.toHaveBeenCalled();
    });
});

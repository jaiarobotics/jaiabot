import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";

import SaveZoneButton from "../SaveZoneButton";

import { JaiaContext, JaiaDispatchContext } from "../../../../../context/JaiaContext";
import { JaiaActions } from "../../../../../context/jaia-actions";
import {
    makeMutableState,
    resetHandlerSingletons,
    squareZone,
} from "../../../../../context/handlers/__tests__/handler-test-utils";
import { exclusionZoneSet } from "../../../../../data/exclusion_zones/exclusion-zone-set";

jest.mock("../../../../../utils/jaia-rest-api", () => ({
    ...jest.requireActual("../../../../../utils/jaia-rest-api"),
    jaia_rest_api: { request: jest.fn() },
}));

import { jaia_rest_api } from "../../../../../utils/jaia-rest-api";

const mockRequest = jaia_rest_api.request as jest.Mock;

async function saveAs(saveName: string) {
    const dispatch = jest.fn();
    const onSaved = jest.fn();
    render(
        <JaiaContext.Provider value={makeMutableState()}>
            <JaiaDispatchContext.Provider value={dispatch}>
                <SaveZoneButton saveName={saveName} savedNames={[]} onSaved={onSaved} />
            </JaiaDispatchContext.Provider>
        </JaiaContext.Provider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "save-zone-set" }));
    return { dispatch, onSaved };
}

beforeEach(() => {
    resetHandlerSingletons();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
    exclusionZoneSet.setName("Original");
    jest.clearAllMocks();
});

describe("SaveZoneButton", () => {
    test("saves under the typed name, then renames the set through the tracked action", async () => {
        mockRequest.mockResolvedValue({});

        const { dispatch, onSaved } = await saveAs(" Saved ");

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(mockRequest.mock.calls[0][0].record_query.save_name).toBe("Saved");
        expect(exclusionZoneSet.getName()).toBe("Original");
        expect(dispatch).toHaveBeenCalledWith({
            type: JaiaActions.CHANGE_EXCLUSION_ZONE_SET_NAME,
            exclusionZoneSetName: "Saved",
        });
    });

    test("keeps the name until the hub has saved the set", async () => {
        let finishSave: (value: object) => void = () => {};
        mockRequest.mockReturnValue(new Promise((resolve) => (finishSave = resolve)));

        const { dispatch, onSaved } = await saveAs("Saved");

        expect(mockRequest).toHaveBeenCalled();
        expect(exclusionZoneSet.getName()).toBe("Original");
        expect(dispatch).not.toHaveBeenCalled();

        finishSave({});
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(dispatch).toHaveBeenCalled();
    });

    test("asks for a name instead of saving under a blank one", async () => {
        const { dispatch } = await saveAs("   ");

        expect(screen.getByText("Please name the zone set before saving.")).toBeVisible();
        expect(mockRequest).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });
});

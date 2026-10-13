import {
    handleChangeTaskPacketWindow,
    handleChangeTaskPacketSelection,
    handleChangeTaskPacketSlider,
    handleCommitTaskPacketSlider,
    handleResetTaskPacketFilter,
} from "../task-packet-filter-handlers";
import { syncTaskLayers, syncTaskPacketMarkerLayers } from "../handler-utils";
import { refreshTaskPacketsForWindow } from "../../../jcc/polling";
import { getTodayWindow, taskPacketFilter } from "../../../data/task_packets/task-packet-filter";
import { JaiaActions } from "../../jaia-actions";
import { JaiaContextType } from "../../../types/context-types";

// The layer repaints and the network fetch are replaced so the handlers can be tested
// without OpenLayers or a server.
jest.mock("../handler-utils", () => ({
    syncTaskLayers: jest.fn(),
    syncTaskPacketMarkerLayers: jest.fn(),
}));

jest.mock("../../../jcc/polling", () => ({
    refreshTaskPacketsForWindow: jest.fn(),
}));

const mutableState = {} as JaiaContextType;

beforeEach(() => {
    jest.clearAllMocks();
    (refreshTaskPacketsForWindow as jest.Mock).mockResolvedValue(true);
    taskPacketFilter.reset();
});

describe("handleChangeTaskPacketWindow", () => {
    test("sets the window, shows every mission set, resets the slider, then fetches", () => {
        const start = new Date("2026-06-01T00:00");
        const end = new Date("2026-06-02T23:59");
        (refreshTaskPacketsForWindow as jest.Mock).mockImplementation(async () => {
            // The window must already be set so the fetch requests it.
            expect(taskPacketFilter.getStartDate()).toBe(start);
            return true;
        });
        taskPacketFilter.setDeselectedMissionSetKeys(new Set(["A"]));
        taskPacketFilter.setSliderWindow(1000, 2000);
        taskPacketFilter.setAutoFollowUpper(false);

        const result = handleChangeTaskPacketWindow(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_WINDOW,
            filterStartDate: start,
            filterEndDate: end,
        });

        expect(result).toBe(mutableState);
        expect(taskPacketFilter.getStartDate()).toBe(start);
        expect(taskPacketFilter.getEndDate()).toBe(end);
        expect(taskPacketFilter.getDeselectedMissionSetKeys().size).toBe(0);
        expect(taskPacketFilter.getSliderLowerUtime()).toBe(0);
        expect(taskPacketFilter.getSliderUpperUtime()).toBe(0);
        expect(taskPacketFilter.getAutoFollowUpper()).toBe(true);
        expect(refreshTaskPacketsForWindow).toHaveBeenCalledTimes(1);
    });

    test("ignores an action missing a window date", () => {
        const { start } = getTodayWindow();
        taskPacketFilter.setDeselectedMissionSetKeys(new Set(["A"]));

        handleChangeTaskPacketWindow(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_WINDOW,
            filterStartDate: new Date("2026-06-01T00:00"),
        });

        expect(taskPacketFilter.getStartDate()).toEqual(start);
        expect(taskPacketFilter.getDeselectedMissionSetKeys()).toEqual(new Set(["A"]));
        expect(refreshTaskPacketsForWindow).not.toHaveBeenCalled();
    });
});

describe("handleChangeTaskPacketSelection", () => {
    test("updates the unchecked mission sets, resets the slider, and repaints", () => {
        taskPacketFilter.setSliderWindow(1000, 2000);
        taskPacketFilter.setAutoFollowUpper(false);

        handleChangeTaskPacketSelection(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_SELECTION,
            deselectedMissionSetKeys: new Set(["A", "B"]),
        });

        expect(taskPacketFilter.getDeselectedMissionSetKeys()).toEqual(new Set(["A", "B"]));
        expect(taskPacketFilter.getSliderLowerUtime()).toBe(0);
        expect(taskPacketFilter.getSliderUpperUtime()).toBe(0);
        expect(taskPacketFilter.getAutoFollowUpper()).toBe(true);
        expect(syncTaskLayers).toHaveBeenCalledTimes(1);
    });

    test("shows every mission set when the action omits the unchecked set", () => {
        taskPacketFilter.setDeselectedMissionSetKeys(new Set(["A"]));

        handleChangeTaskPacketSelection(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_SELECTION,
        });

        expect(taskPacketFilter.getDeselectedMissionSetKeys().size).toBe(0);
    });
});

describe("handleChangeTaskPacketSlider", () => {
    test("sets the slider window and repaints only the marker layers", () => {
        handleChangeTaskPacketSlider(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_SLIDER,
            sliderLowerUtime: 1000,
            sliderUpperUtime: 2000,
            autoFollowUpper: false,
        });

        expect(taskPacketFilter.getSliderLowerUtime()).toBe(1000);
        expect(taskPacketFilter.getSliderUpperUtime()).toBe(2000);
        expect(taskPacketFilter.getAutoFollowUpper()).toBe(false);
        expect(syncTaskPacketMarkerLayers).toHaveBeenCalledTimes(1);
        expect(syncTaskLayers).not.toHaveBeenCalled();
    });

    test("leaves auto-follow unchanged when the action omits it", () => {
        taskPacketFilter.setAutoFollowUpper(false);

        handleChangeTaskPacketSlider(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_SLIDER,
            sliderLowerUtime: 1000,
            sliderUpperUtime: 2000,
        });

        expect(taskPacketFilter.getAutoFollowUpper()).toBe(false);
    });
});

describe("handleCommitTaskPacketSlider", () => {
    test("repaints all task layers, including the contour", () => {
        handleCommitTaskPacketSlider(mutableState);

        expect(syncTaskLayers).toHaveBeenCalledTimes(1);
    });
});

describe("handleResetTaskPacketFilter", () => {
    test("resets the filter to today, then fetches that window", () => {
        const { start, end } = getTodayWindow();
        (refreshTaskPacketsForWindow as jest.Mock).mockImplementation(async () => {
            // The filter must already be reset so the fetch requests today's window.
            expect(taskPacketFilter.getStartDate()).toEqual(start);
            return true;
        });
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-01T00:00"),
            new Date("2026-06-01T23:59"),
        );
        taskPacketFilter.setDeselectedMissionSetKeys(new Set(["A"]));
        taskPacketFilter.setSliderWindow(1000, 2000);

        handleResetTaskPacketFilter(mutableState);

        expect(taskPacketFilter.getStartDate()).toEqual(start);
        expect(taskPacketFilter.getEndDate()).toEqual(end);
        expect(taskPacketFilter.getDeselectedMissionSetKeys().size).toBe(0);
        expect(taskPacketFilter.getSliderUpperUtime()).toBe(0);
        expect(refreshTaskPacketsForWindow).toHaveBeenCalledTimes(1);
    });
});

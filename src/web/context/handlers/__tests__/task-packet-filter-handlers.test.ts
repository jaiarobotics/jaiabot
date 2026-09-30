import {
    handleRunTaskPacketSearch,
    handleChangeTaskPacketSelection,
    handleChangeTaskPacketSlider,
    handleCommitTaskPacketSlider,
    handleClearTaskPacketFilter,
} from "../task-packet-filter-handlers";
import { syncTaskLayers, syncTaskPacketMarkerLayers } from "../handler-utils";
import { fetchTaskPacketsForWindow } from "../../../jcc/polling";
import { taskPackets } from "../../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../../data/task_packets/task-packet-filter";
import { JaiaActions } from "../../jaia-actions";
import { JaiaContextType } from "../../../types/context-types";
import { TaskPacket } from "../../../types/protobuf-types";

// The layer repaints and the network fetch are replaced so the handlers can be tested
// without OpenLayers or a server.
jest.mock("../handler-utils", () => ({
    syncTaskLayers: jest.fn(),
    syncTaskPacketMarkerLayers: jest.fn(),
}));

jest.mock("../../../jcc/polling", () => ({
    fetchTaskPacketsForWindow: jest.fn(),
}));

const mutableState = {} as JaiaContextType;

/**
 * Builds a minimal task packet for tests.
 *
 * @param {number} startTime start_time in microseconds
 * @param {string} [missionName] Optional mission set name
 * @returns {TaskPacket} A task packet
 */
function makeTaskPacket(startTime: number, missionName?: string): TaskPacket {
    return { start_time: startTime, mission_name: missionName } as unknown as TaskPacket;
}

beforeEach(() => {
    jest.clearAllMocks();
    taskPacketFilter.clear();
    taskPackets.setIncludedTaskPackets([]);
    taskPackets.setExcludedTaskPackets([]);
});

describe("handleRunTaskPacketSearch", () => {
    test("loads the packets, activates the filter, resets the slider, and repaints", () => {
        const included = [makeTaskPacket(1000, "A")];
        const excluded = [makeTaskPacket(2000, "B")];
        const start = new Date("2026-06-01T00:00:00");
        const end = new Date("2026-06-01T23:59:59");
        taskPacketFilter.setSliderWindow(1000, 2000);
        taskPacketFilter.setAutoFollowUpper(false);

        const result = handleRunTaskPacketSearch(mutableState, {
            type: JaiaActions.RUN_TASK_PACKET_SEARCH,
            includedTaskPackets: included,
            excludedTaskPackets: excluded,
            filterStartDate: start,
            filterEndDate: end,
            selectedMissionSetKeys: new Set(["A"]),
        });

        expect(result).toBe(mutableState);
        expect(taskPackets.getIncludedTaskPackets()).toBe(included);
        expect(taskPackets.getExcludedTaskPackets()).toBe(excluded);
        expect(taskPacketFilter.isActive()).toBe(true);
        expect(taskPacketFilter.getStartDate()).toBe(start);
        expect(taskPacketFilter.getEndDate()).toBe(end);
        expect(taskPacketFilter.getSelectedMissionSetKeys()).toEqual(new Set(["A"]));
        expect(taskPacketFilter.getSliderLowerUtime()).toBe(0);
        expect(taskPacketFilter.getSliderUpperUtime()).toBe(0);
        expect(taskPacketFilter.getAutoFollowUpper()).toBe(true);
        expect(syncTaskLayers).toHaveBeenCalledTimes(1);
    });

    test("leaves the filter inactive when no window dates are given", () => {
        handleRunTaskPacketSearch(mutableState, {
            type: JaiaActions.RUN_TASK_PACKET_SEARCH,
            selectedMissionSetKeys: new Set(["A"]),
        });

        expect(taskPacketFilter.isActive()).toBe(false);
        expect(taskPackets.getIncludedTaskPackets()).toEqual([]);
        expect(taskPackets.getExcludedTaskPackets()).toEqual([]);
    });
});

describe("handleChangeTaskPacketSelection", () => {
    test("updates the selection, resets the slider, and repaints", () => {
        taskPacketFilter.setSliderWindow(1000, 2000);
        taskPacketFilter.setAutoFollowUpper(false);

        handleChangeTaskPacketSelection(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_SELECTION,
            selectedMissionSetKeys: new Set(["A", "B"]),
        });

        expect(taskPacketFilter.getSelectedMissionSetKeys()).toEqual(new Set(["A", "B"]));
        expect(taskPacketFilter.getSliderUpperUtime()).toBe(0);
        expect(taskPacketFilter.getAutoFollowUpper()).toBe(true);
        expect(syncTaskLayers).toHaveBeenCalledTimes(1);
    });

    test("keeps the slider when the selection is emptied", () => {
        taskPacketFilter.setSelectedMissionSetKeys(new Set(["A"]));
        taskPacketFilter.setSliderWindow(1000, 2000);
        taskPacketFilter.setAutoFollowUpper(false);

        handleChangeTaskPacketSelection(mutableState, {
            type: JaiaActions.CHANGE_TASK_PACKET_SELECTION,
            selectedMissionSetKeys: new Set(),
        });

        expect(taskPacketFilter.getSelectedMissionSetKeys().size).toBe(0);
        expect(taskPacketFilter.getSliderLowerUtime()).toBe(1000);
        expect(taskPacketFilter.getSliderUpperUtime()).toBe(2000);
        expect(taskPacketFilter.getAutoFollowUpper()).toBe(false);
        expect(syncTaskLayers).toHaveBeenCalledTimes(1);
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

describe("handleClearTaskPacketFilter", () => {
    test("deactivates the filter, reloads the default window, and repaints", async () => {
        const included = [makeTaskPacket(1000, "A")];
        const excluded = [makeTaskPacket(2000)];
        (fetchTaskPacketsForWindow as jest.Mock).mockResolvedValue({
            result: { included, excluded },
        });
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-01T00:00:00"),
            new Date("2026-06-01T23:59:59"),
        );
        taskPacketFilter.setSelectedMissionSetKeys(new Set(["A"]));

        handleClearTaskPacketFilter(mutableState);

        // The filter is cleared before the fetch, so the fetch requests the default window.
        expect(taskPacketFilter.isActive()).toBe(false);
        expect(fetchTaskPacketsForWindow).toHaveBeenCalledTimes(1);

        await (fetchTaskPacketsForWindow as jest.Mock).mock.results[0].value;

        expect(taskPackets.getIncludedTaskPackets()).toBe(included);
        expect(taskPackets.getExcludedTaskPackets()).toBe(excluded);
        expect(syncTaskLayers).toHaveBeenCalledTimes(1);
    });
});

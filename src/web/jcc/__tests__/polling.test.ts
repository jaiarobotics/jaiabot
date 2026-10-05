import {
    invalidateTaskPacketRequests,
    pollTaskPackets,
    refreshTaskPacketsForWindow,
} from "../polling";
import { taskPackets } from "../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../data/task_packets/task-packet-filter";
import { contourLayer } from "../../openlayers/layers/vector/contour-layer";
import { TaskPacket } from "../../types/protobuf-types";
import { convertHTMLStrDateToISO } from "../../shared/Utilities";

// The map layers are replaced so polling can be tested without OpenLayers.
jest.mock("../../openlayers/layers/vector/bot-layer", () => ({ botLayer: {} }));
jest.mock("../../openlayers/layers/vector/hub-layer", () => ({ hubLayer: {} }));
jest.mock("../../openlayers/layers/vector/mission-layer", () => ({
    missionLayer: {},
    ghostMissionLayer: {},
}));
jest.mock("../../openlayers/layers/vector/hub-comms-layer", () => ({ hubCommsLayer: {} }));
jest.mock("../../openlayers/layers/vector/dive-layer", () => ({
    diveLayer: { updateFeatures: jest.fn() },
}));
jest.mock("../../openlayers/layers/vector/drift-layer", () => ({
    driftLayer: { updateFeatures: jest.fn() },
}));
jest.mock("../../openlayers/layers/vector/contour-layer", () => ({
    contourLayer: { updateFeatures: jest.fn() },
}));
jest.mock("../../openlayers/layers/vector/excluded-task-packets-layer", () => ({
    excludedTaskPacketsLayer: { updateFeatures: jest.fn() },
}));
jest.mock("../../style/audio/sound-effects", () => ({}));

type TaskPacketsBody = { result: { included: TaskPacket[]; excluded: TaskPacket[] } };

/**
 * A pending task packet response the test resolves when it chooses, so responses can be made to
 * arrive in any order.
 */
interface PendingResponse {
    resolve: (body: TaskPacketsBody) => void;
}

let pendingResponses: PendingResponse[] = [];

/**
 * Builds a minimal task packet for tests.
 *
 * @param {number} startTime start_time in microseconds
 * @returns {TaskPacket} A task packet
 */
function makeTaskPacket(startTime: number): TaskPacket {
    return { start_time: startTime } as unknown as TaskPacket;
}

/**
 * Lets pending promise callbacks run.
 *
 * @returns {Promise<void>}
 */
function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Runs a poll after one task packet fetch has completed and checks it doesn't fetch again. Any
 * unexpected fetch is resolved so the poll finishes instead of hanging the test.
 *
 * @returns {Promise<void>}
 */
async function expectPollSkipsFetch() {
    const poll = pollTaskPackets();
    await flushPromises();
    const fetchCount = pendingResponses.length;
    pendingResponses
        .slice(1)
        .forEach((response) => response.resolve({ result: { included: [], excluded: [] } }));
    await poll;
    expect(fetchCount).toBe(1);
}

beforeEach(() => {
    pendingResponses = [];
    taskPacketFilter.reset();
    taskPackets.setIncludedTaskPackets([]);
    taskPackets.setExcludedTaskPackets([]);
    taskPackets.setVersion(0);
    // Each task packet fetch waits for the test to resolve it; the version endpoint returns 5.
    global.fetch = jest.fn((url: string) => {
        if (url.includes("task-packets-version")) {
            return Promise.resolve({ ok: true, json: () => Promise.resolve(5) });
        }
        return new Promise((resolve) => {
            pendingResponses.push({
                resolve: (body) => resolve({ ok: true, json: () => Promise.resolve(body) }),
            });
        });
    }) as unknown as typeof fetch;
});

describe("refreshTaskPacketsForWindow", () => {
    test("loads the response into the data model and repaints", async () => {
        const included = [makeTaskPacket(1000)];
        const excluded = [makeTaskPacket(2000)];

        const refresh = refreshTaskPacketsForWindow();
        await flushPromises();
        pendingResponses[0].resolve({ result: { included, excluded } });

        expect(await refresh).toBe(true);
        expect(taskPackets.getIncludedTaskPackets()).toBe(included);
        expect(taskPackets.getExcludedTaskPackets()).toBe(excluded);
        expect(contourLayer.updateFeatures).toHaveBeenCalledTimes(1);
    });

    test("drops an older response that arrives after a newer one", async () => {
        // A suppressed packet: still included in the older response, excluded in the newer one.
        const suppressed = makeTaskPacket(1000);

        const older = refreshTaskPacketsForWindow();
        const newer = refreshTaskPacketsForWindow();
        await flushPromises();
        pendingResponses[1].resolve({ result: { included: [], excluded: [suppressed] } });
        expect(await newer).toBe(true);
        pendingResponses[0].resolve({ result: { included: [suppressed], excluded: [] } });

        expect(await older).toBe(false);
        expect(taskPackets.getIncludedTaskPackets()).toEqual([]);
        expect(taskPackets.getExcludedTaskPackets()).toEqual([suppressed]);
        expect(contourLayer.updateFeatures).toHaveBeenCalledTimes(1);
    });

    test("drops a response that was in flight when requests were invalidated", async () => {
        const searched = [makeTaskPacket(3000)];

        const refresh = refreshTaskPacketsForWindow();
        await flushPromises();
        taskPackets.setIncludedTaskPackets(searched);
        invalidateTaskPacketRequests();
        pendingResponses[0].resolve({ result: { included: [makeTaskPacket(1000)], excluded: [] } });

        expect(await refresh).toBe(false);
        expect(taskPackets.getIncludedTaskPackets()).toBe(searched);
    });
});

describe("pollTaskPackets", () => {
    test("records the version when its response is applied", async () => {
        const poll = pollTaskPackets();
        await flushPromises();
        pendingResponses[0].resolve({ result: { included: [], excluded: [] } });
        await poll;

        expect(taskPackets.getVersion()).toBe(5);
    });

    test("does not record the version when its response is superseded", async () => {
        const poll = pollTaskPackets();
        await flushPromises();
        invalidateTaskPacketRequests();
        pendingResponses[0].resolve({ result: { included: [makeTaskPacket(1000)], excluded: [] } });
        await poll;

        // Leaving the version unrecorded makes the next poll fetch again.
        expect(taskPackets.getVersion()).toBe(0);
        expect(taskPackets.getIncludedTaskPackets()).toEqual([]);
    });

    // Each test below uses its own filter window, since the last fetched window persists across
    // tests in the polling module.

    test("refetches when the filter window changes, even with an unchanged version", async () => {
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-01T00:00"),
            new Date("2026-06-01T23:59"),
        );
        taskPackets.setVersion(5);

        const poll = pollTaskPackets();
        await flushPromises();
        expect(pendingResponses).toHaveLength(1);
        pendingResponses[0].resolve({ result: { included: [], excluded: [] } });
        await poll;

        const taskPacketUrl = (global.fetch as jest.Mock).mock.calls
            .map(([url]) => url as string)
            .find((url) => !url.includes("task-packets-version"));
        expect(taskPacketUrl).toContain(`startDate=${convertHTMLStrDateToISO("2026-06-01 00:00")}`);
        expect(taskPacketUrl).toContain(`endDate=${convertHTMLStrDateToISO("2026-06-01 23:59")}`);
    });

    test("skips the fetch when neither the window nor the version has changed", async () => {
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-02T00:00"),
            new Date("2026-06-02T23:59"),
        );

        const first = pollTaskPackets();
        await flushPromises();
        pendingResponses[0].resolve({ result: { included: [], excluded: [] } });
        await first;
        await expectPollSkipsFetch();
    });

    test("records the window it fetched when the filter changes during the version check", async () => {
        const poll = pollTaskPackets();
        // The poll is now waiting on the version endpoint.
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-03T00:00"),
            new Date("2026-06-03T23:59"),
        );
        await flushPromises();
        pendingResponses[0].resolve({ result: { included: [], excluded: [] } });
        await poll;

        // The first poll fetched the new window, so the second has nothing to refetch.
        await expectPollSkipsFetch();
    });

    test("skips the fetch after a refresh outside the poll already loaded the window", async () => {
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-04T00:00"),
            new Date("2026-06-04T23:59"),
        );
        taskPackets.setVersion(5);

        const refresh = refreshTaskPacketsForWindow();
        await flushPromises();
        pendingResponses[0].resolve({ result: { included: [], excluded: [] } });
        await refresh;
        await expectPollSkipsFetch();
    });
});

import {
    invalidateTaskPacketRequests,
    pollTaskPackets,
    refreshTaskPacketsForWindow,
} from "../polling";
import { taskPackets } from "../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../data/task_packets/task-packet-filter";
import { contourLayer } from "../../openlayers/layers/vector/contour-layer";
import { TaskPacket } from "../../types/protobuf-types";

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

beforeEach(() => {
    pendingResponses = [];
    taskPacketFilter.clear();
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
});

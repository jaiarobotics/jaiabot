import { pollStatus, pollTaskPackets, refreshTaskPacketsForWindow } from "../polling";
import { bots } from "../../data/bots/bots";
import { hubs } from "../../data/hubs/hubs";
import SoundEffects from "../../style/audio/sound-effects";
import { taskPackets } from "../../data/task_packets/task-packets";
import { taskPacketFilter } from "../../data/task_packets/task-packet-filter";
import { contourLayer } from "../../openlayers/layers/vector/contour-layer";
import { TaskPacket } from "@proto/jaiabot/messages/jaia_dccl";
import { Engineering } from "@proto/jaiabot/messages/engineering";
import { APIRequest, APIResponse, TaskPacketQuery } from "@proto/jaiabot/messages/rest_api";

// The map layers are replaced so polling can be tested without OpenLayers.
jest.mock("../../openlayers/layers/vector/bot-layer", () => ({
    botLayer: { updateFeatures: jest.fn() },
}));
jest.mock("../../openlayers/layers/vector/hub-layer", () => ({
    hubLayer: { updateFeatures: jest.fn() },
}));
jest.mock("../../openlayers/layers/vector/mission-layer", () => ({
    missionLayer: { updateFeatures: jest.fn() },
    ghostMissionLayer: { updateFeatures: jest.fn() },
}));
jest.mock("../../openlayers/layers/vector/hub-comms-layer", () => ({
    hubCommsLayer: { updateFeatures: jest.fn() },
}));
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
jest.mock("../../style/audio/sound-effects", () => ({
    __esModule: true,
    default: { botDisconnect: { play: jest.fn() }, botReconnect: { play: jest.fn() } },
}));

type TaskPacketsBody = { included: TaskPacket[]; excluded: TaskPacket[] };

/**
 * A pending task packet response the test resolves when it chooses, so responses can be made to
 * arrive in any order. It answers both the included and excluded requests of one refresh.
 */
interface PendingResponse {
    resolve: (body: TaskPacketsBody) => void;
    body: Promise<TaskPacketsBody>;
}

let pendingResponses: PendingResponse[] = [];

// A refresh asks for its excluded packets once its included packets arrive
let lastResolvedBody: Promise<TaskPacketsBody>;

// Version of the fake hub's task packets
let hubVersion = 5;

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
        .forEach((response) => response.resolve({ included: [], excluded: [] }));
    await poll;
    expect(fetchCount).toBe(1);
}

/**
 * Returns the task packet queries JCC has sent so far.
 *
 * @returns {TaskPacketQuery[]} Queries in the order they were sent
 */
function sentTaskPacketQueries(): TaskPacketQuery[] {
    return (global.fetch as jest.Mock).mock.calls
        .map(([, init]) => (JSON.parse(init.body) as APIRequest).task_packets)
        .filter((query) => query !== undefined);
}

beforeEach(() => {
    pendingResponses = [];
    hubVersion = 5;
    taskPacketFilter.reset();
    taskPackets.setIncludedTaskPackets([]);
    taskPackets.setExcludedTaskPackets([]);
    taskPackets.setVersion(0);
    // The hub answers a current known_version at once; any other fetch waits for the test.
    global.fetch = jest.fn((_url: string, init: RequestInit) => {
        const query = (JSON.parse(init.body as string) as APIRequest).task_packets;
        const version = hubVersion;
        const respond = (body: APIResponse) => ({ ok: true, json: () => Promise.resolve(body) });

        if (query?.known_version === version) {
            return Promise.resolve(respond({ task_packets: { version, unchanged: true } }));
        }

        if (query?.included_only) {
            let resolveBody: (body: TaskPacketsBody) => void;
            const body = new Promise<TaskPacketsBody>((r) => (resolveBody = r));
            pendingResponses.push({
                resolve: (resolved) => {
                    lastResolvedBody = body;
                    resolveBody(resolved);
                },
                body,
            });
            return body.then((resolved) =>
                respond({ task_packets: { packets: resolved.included, version } }),
            );
        }
        return lastResolvedBody.then((resolved) =>
            respond({ task_packets: { packets: resolved.excluded, version } }),
        );
    }) as unknown as typeof fetch;
});

afterEach(() => {
    jest.useRealTimers();
});

describe("refreshTaskPacketsForWindow", () => {
    test("loads the response into the data model and repaints", async () => {
        const included = [makeTaskPacket(1000)];
        const excluded = [makeTaskPacket(2000)];

        const refresh = refreshTaskPacketsForWindow();
        await flushPromises();
        pendingResponses[0].resolve({ included, excluded });

        expect(await refresh).toBe(true);
        expect(taskPackets.getIncludedTaskPackets()).toBe(included);
        expect(taskPackets.getExcludedTaskPackets()).toBe(excluded);
        expect(taskPackets.getVersion()).toBe(5);
        expect(contourLayer.updateFeatures).toHaveBeenCalledTimes(1);
    });

    test("drops an older response that arrives after a newer one", async () => {
        // A suppressed packet: still included in the older response, excluded in the newer one.
        const suppressed = makeTaskPacket(1000);

        const older = refreshTaskPacketsForWindow();
        const newer = refreshTaskPacketsForWindow();
        await flushPromises();
        pendingResponses[1].resolve({ included: [], excluded: [suppressed] });
        expect(await newer).toBe(true);
        pendingResponses[0].resolve({ included: [suppressed], excluded: [] });

        expect(await older).toBe(false);
        expect(taskPackets.getIncludedTaskPackets()).toEqual([]);
        expect(taskPackets.getExcludedTaskPackets()).toEqual([suppressed]);
        expect(contourLayer.updateFeatures).toHaveBeenCalledTimes(1);
    });
});

describe("pollTaskPackets", () => {
    test("records the version when its response is applied", async () => {
        const poll = pollTaskPackets();
        await flushPromises();
        pendingResponses[0].resolve({ included: [], excluded: [] });
        await poll;

        expect(taskPackets.getVersion()).toBe(5);
    });

    test("does not record the version when its response is superseded", async () => {
        const poll = pollTaskPackets();
        await flushPromises();
        // A newer refresh, e.g. from a window change, supersedes the poll's fetch.
        refreshTaskPacketsForWindow();
        pendingResponses[0].resolve({ included: [makeTaskPacket(1000)], excluded: [] });
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
        pendingResponses[0].resolve({ included: [], excluded: [] });
        await poll;

        const taskPacketQuery = sentTaskPacketQueries()[0];
        expect(taskPacketQuery?.known_version).toBeUndefined();
        expect(taskPacketQuery?.start_time).toBe(
            String(new Date("2026-06-01T00:00").getTime() * 1000),
        );
        expect(taskPacketQuery?.end_time).toBe(
            String(new Date("2026-06-01T23:59").getTime() * 1000),
        );
    });

    test("queries the included and the excluded packets separately", async () => {
        const poll = pollTaskPackets();
        await flushPromises();
        pendingResponses[0].resolve({ included: [], excluded: [] });
        await poll;

        const inclusions = sentTaskPacketQueries().map(({ included_only, excluded_only }) => ({
            included_only,
            excluded_only,
        }));
        expect(inclusions).toEqual([
            { included_only: true, excluded_only: undefined },
            { included_only: undefined, excluded_only: true },
        ]);
    });

    test("skips the fetch when neither the window nor the version has changed", async () => {
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-02T00:00"),
            new Date("2026-06-02T23:59"),
        );

        const first = pollTaskPackets();
        await flushPromises();
        pendingResponses[0].resolve({ included: [], excluded: [] });
        await first;
        await expectPollSkipsFetch();
    });

    test("refetches the new window when the filter changes during a fetch", async () => {
        const poll = pollTaskPackets();
        // The poll's fetch is now in flight for the old window.
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-03T00:00"),
            new Date("2026-06-03T23:59"),
        );
        await flushPromises();
        pendingResponses[0].resolve({ included: [], excluded: [] });
        await poll;

        const nextPoll = pollTaskPackets();
        await flushPromises();
        expect(pendingResponses).toHaveLength(2);
        pendingResponses[1].resolve({ included: [], excluded: [] });
        await nextPoll;

        const lastQuery = sentTaskPacketQueries().at(-1);
        expect(lastQuery?.known_version).toBeUndefined();
        expect(lastQuery?.start_time).toBe(String(new Date("2026-06-03T00:00").getTime() * 1000));
    });

    test("skips the fetch after a refresh outside the poll already loaded the window", async () => {
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-04T00:00"),
            new Date("2026-06-04T23:59"),
        );
        taskPackets.setVersion(5);

        const refresh = refreshTaskPacketsForWindow();
        await flushPromises();
        pendingResponses[0].resolve({ included: [], excluded: [] });
        await refresh;
        await expectPollSkipsFetch();
    });

    test("asks only whether the packets changed once a window is loaded", async () => {
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-05T00:00"),
            new Date("2026-06-05T23:59"),
        );
        const included = [makeTaskPacket(1000)];
        const first = pollTaskPackets();
        await flushPromises();
        pendingResponses[0].resolve({ included, excluded: [] });
        await first;
        (global.fetch as jest.Mock).mockClear();
        (contourLayer.updateFeatures as jest.Mock).mockClear();

        await pollTaskPackets();

        expect(sentTaskPacketQueries()).toEqual([
            expect.objectContaining({ included_only: true, known_version: 5 }),
        ]);
        expect(taskPackets.getIncludedTaskPackets()).toBe(included);
        expect(contourLayer.updateFeatures).not.toHaveBeenCalled();
    });

    test("refetches when the hub's packets have changed", async () => {
        taskPacketFilter.setSearchWindow(
            new Date("2026-06-06T00:00"),
            new Date("2026-06-06T23:59"),
        );
        const first = pollTaskPackets();
        await flushPromises();
        pendingResponses[0].resolve({ included: [], excluded: [] });
        await first;

        hubVersion = 6;
        const changed = [makeTaskPacket(2000)];
        const poll = pollTaskPackets();
        await flushPromises();
        pendingResponses[1].resolve({ included: changed, excluded: [] });
        await poll;

        expect(taskPackets.getIncludedTaskPackets()).toBe(changed);
        expect(taskPackets.getVersion()).toBe(6);
    });
});

describe("pollStatus", () => {
    /**
     * Answers status requests with one hub whose status arrived ageMicros before the hub's time.
     *
     * @param {number} ageMicros Age of the hub's status in microseconds
     * @returns {void}
     */
    function respondWithHubStatusAge(ageMicros: number) {
        global.fetch = jest.fn((_url: string, init: RequestInit) => {
            const request: APIRequest = JSON.parse(init.body as string);
            const body: APIResponse = request.engineering_status
                ? {}
                : {
                      status: {
                          hubs: [{ hub_id: 1, received_time: "1000000" }],
                          time: String(1_000_000 + ageMicros),
                      },
                  };
            return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
        }) as unknown as typeof fetch;
    }

    test("warns when the hub's status stops updating although the REST API answers", async () => {
        document.body.innerHTML = '<div id="connection-warning"></div>';
        const warning = document.getElementById("connection-warning");

        respondWithHubStatusAge(1_000_000);
        await pollStatus();
        expect(warning.style.visibility).toBe("hidden");

        respondWithHubStatusAge(60_000_000);
        await pollStatus();
        expect(warning.style.visibility).toBe("visible");

        respondWithHubStatusAge(1_000_000);
        await pollStatus();
        expect(warning.style.visibility).toBe("hidden");
    });

    test("combines each bot's status with its engineering status", async () => {
        const engineering: Engineering = { bot_id: 7, query_engineering_status: true };
        global.fetch = jest.fn((_url: string, init: RequestInit) => {
            const request: APIRequest = JSON.parse(init.body as string);
            const body: APIResponse = request.engineering_status
                ? { engineering_status: { bots: [engineering] } }
                : { status: { bots: [{ bot_id: 7, received_time: "1000" }], time: "3000" } };
            return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
        }) as unknown as typeof fetch;

        await pollStatus();

        expect(bots.getBot(7)?.getEngineering()).toEqual(engineering);
        expect(bots.getBot(7)?.getStatusAge()).toBe(2000);
    });

    test("ages the bots and hubs a restarted REST API no longer reports", async () => {
        let statusBody: APIResponse;
        global.fetch = jest.fn((_url: string, init: RequestInit) => {
            const request: APIRequest = JSON.parse(init.body as string);
            const body: APIResponse = request.engineering_status ? {} : statusBody;
            return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
        }) as unknown as typeof fetch;
        const hubTime = 10_000_000_000;

        statusBody = {
            status: {
                bots: [{ bot_id: 9, received_time: String(hubTime - 1_000_000) }],
                hubs: [
                    { hub_id: 2, received_time: String(hubTime) },
                    { hub_id: 3, received_time: String(hubTime - 1_000_000) },
                ],
                time: String(hubTime),
            },
        };
        await pollStatus();
        expect(bots.getBot(9)?.isCommsDropped()).toBe(false);
        (SoundEffects.botDisconnect.play as jest.Mock).mockClear();

        // Restarted, the REST API has only heard from its own hub
        statusBody = {
            status: {
                hubs: [{ hub_id: 2, received_time: String(hubTime + 60_000_000) }],
                time: String(hubTime + 60_000_000),
            },
        };
        await pollStatus();

        expect(bots.getBot(9)?.getStatusAge()).toBe(61_000_000);
        expect(bots.getBot(9)?.isCommsDropped()).toBe(true);
        expect(SoundEffects.botDisconnect.play).toHaveBeenCalled();
        expect(hubs.getHub(3)?.getStatusAge()).toBe(61_000_000);
        expect(hubs.getHub(3)?.isCommsDropped()).toBe(true);
    });

    test("a relayed hub that stops reporting ages out without the connection warning", async () => {
        document.body.innerHTML = '<div id="connection-warning"></div>';
        const warning = document.getElementById("connection-warning");
        const hubTime = 20_000_000_000;
        const respondWithHubAges = (localAgeMicros: number, relayedAgeMicros: number) => {
            const body: APIResponse = {
                status: {
                    hubs: [
                        { hub_id: 11, received_time: String(hubTime - localAgeMicros) },
                        { hub_id: 12, received_time: String(hubTime - relayedAgeMicros) },
                    ],
                    time: String(hubTime),
                },
            };
            global.fetch = jest.fn((_url: string, init: RequestInit) => {
                const request: APIRequest = JSON.parse(init.body as string);
                const response = request.engineering_status ? {} : body;
                return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
            }) as unknown as typeof fetch;
        };

        // The local hub reports; the hub relayed through it has gone quiet
        respondWithHubAges(1_000_000, 60_000_000);
        await pollStatus();
        expect(warning.style.visibility).toBe("hidden");
        expect(hubs.getHub(11)?.isCommsDropped()).toBe(false);
        expect(hubs.getHub(12)?.isCommsDropped()).toBe(true);

        // The local hub's portal stops too
        respondWithHubAges(60_000_000, 120_000_000);
        await pollStatus();
        expect(warning.style.visibility).toBe("visible");
    });

    test("keeps polling after a response without a status", async () => {
        let statusBody: APIResponse = {};
        global.fetch = jest.fn((_url: string, init: RequestInit) => {
            const request: APIRequest = JSON.parse(init.body as string);
            const body: APIResponse = request.engineering_status ? {} : statusBody;
            return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
        }) as unknown as typeof fetch;

        await pollStatus();

        statusBody = { status: { bots: [{ bot_id: 8, received_time: "1000" }], time: "1500" } };
        await pollStatus();

        expect(bots.getBot(8)?.getStatusAge()).toBe(500);
    });

    test("polls again after a request the hub never answers", async () => {
        jest.useFakeTimers();
        // Like a request in flight when the hub lost power: it settles only if aborted.
        global.fetch = jest.fn(
            (_url: string, init: RequestInit) =>
                new Promise((_resolve, reject) =>
                    init.signal?.addEventListener("abort", () => reject(init.signal?.reason)),
                ),
        ) as unknown as typeof fetch;

        pollStatus();
        await jest.advanceTimersByTimeAsync(60_000);
        (global.fetch as jest.Mock).mockClear();
        pollStatus();

        expect(global.fetch).toHaveBeenCalled();
    });
});

import {
    ExclusionZoneSetSnapshot,
    EXCLUSION_ZONE_SET_VERSION,
    exclusionZoneSet,
} from "../../../../data/exclusion_zones/exclusion-zone-set";
import {
    listSavedZoneSetsFromHub,
    saveToHub,
    loadSnapshotFromHub,
    deleteFromHub,
    importZonesFromFile,
    ZoneLoadResultType,
} from "../zone-storage";

jest.mock("../../../../utils/jaia-rest-api", () => ({
    ...jest.requireActual("../../../../utils/jaia-rest-api"),
    jaia_rest_api: { request: jest.fn() },
}));

import { jaia_rest_api, JaiaRESTAPIError } from "../../../../utils/jaia-rest-api";
import { APIErrorCode, RecordQuery_RecordType } from "@proto/jaiabot/messages/rest_api";

const mockRequest = jaia_rest_api.request as jest.Mock;

describe("Zone hub storage", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
        jest.clearAllMocks();
    });

    test("listSavedZoneSetsFromHub returns names from the hub", async () => {
        mockRequest.mockResolvedValue({ record_query_response: { names: ["zone-a", "zone-b"] } });
        const names = await listSavedZoneSetsFromHub();
        expect(names).toEqual(["zone-a", "zone-b"]);
        expect(mockRequest).toHaveBeenCalledTimes(1);
        expect(mockRequest.mock.calls[0][0].record_query).toEqual({
            type: RecordQuery_RecordType.EXCLUSION_ZONE,
            list: true,
        });
    });

    test("saveToHub calls the API with the current zone set snapshot", async () => {
        exclusionZoneSet.addZone({
            vertices: [
                { lat: 41.0, lon: -72.0 },
                { lat: 41.001, lon: -72.0 },
                { lat: 41.001, lon: -71.999 },
            ],
        });
        mockRequest.mockResolvedValue({});

        await saveToHub("my-zones");

        expect(mockRequest).toHaveBeenCalledTimes(1);
        const query = mockRequest.mock.calls[0][0].record_query;
        expect(query.type).toBe(RecordQuery_RecordType.EXCLUSION_ZONE);
        expect(query.save_name).toBe("my-zones");
        const saved = JSON.parse(query.save_content);
        expect(saved.zones.length).toBe(1);
        expect(saved.version).toBe(EXCLUSION_ZONE_SET_VERSION);
    });

    test("saveToHub stores the set under the name the snapshot carries", async () => {
        exclusionZoneSet.setName("old-name");
        mockRequest.mockResolvedValue({});

        await saveToHub("new-name");

        const query = mockRequest.mock.calls[0][0].record_query;
        expect(query.save_name).toBe("new-name");
        expect(JSON.parse(query.save_content).name).toBe("new-name");
        expect(exclusionZoneSet.getName()).toBe("new-name");
    });

    test("loadSnapshotFromHub falls back to the requested name for an entry saved without one", async () => {
        mockRequest.mockResolvedValue({
            record_query_response: { content: JSON.stringify({ zones: [], nextZoneID: 1 }) },
        });

        const result = await loadSnapshotFromHub("my-zones");

        expect(result.snapshot!.name).toBe("my-zones");
    });

    test("loadSnapshotFromHub returns a snapshot from the hub", async () => {
        const fakeSnapshot: ExclusionZoneSetSnapshot = {
            zones: [],
            nextZoneID: 1,
            name: "my-zones",
        };
        mockRequest.mockResolvedValue({
            record_query_response: {
                content: JSON.stringify({ ...fakeSnapshot, version: EXCLUSION_ZONE_SET_VERSION }),
            },
        });

        const result = await loadSnapshotFromHub("my-zones");
        expect(result).toEqual({ snapshot: fakeSnapshot, resultType: ZoneLoadResultType.SUCCESS });
        expect(mockRequest.mock.calls[0][0].record_query.get_name).toBe("my-zones");
    });

    test("loadSnapshotFromHub reads an entry saved without a version as 1.0", async () => {
        mockRequest.mockResolvedValue({
            record_query_response: {
                content: JSON.stringify({ zones: [], nextZoneID: 1, name: "a" }),
            },
        });

        const result = await loadSnapshotFromHub("a");

        expect(result.resultType).toBe(ZoneLoadResultType.SUCCESS);
    });

    test("loadSnapshotFromHub refuses a version it does not know", async () => {
        mockRequest.mockResolvedValue({
            record_query_response: {
                content: JSON.stringify({
                    zones: [],
                    nextZoneID: 1,
                    name: "newer",
                    version: "9.9",
                }),
            },
        });

        const result = await loadSnapshotFromHub("newer");

        expect(result).toEqual({ snapshot: null, resultType: ZoneLoadResultType.UNKNOWN_FORMAT });
    });

    test("loadSnapshotFromHub reports nothing loaded when the hub has no entry", async () => {
        mockRequest.mockRejectedValue(
            new JaiaRESTAPIError(APIErrorCode.API_ERROR__RECORD_NOT_FOUND, "Record not found"),
        );
        const result = await loadSnapshotFromHub("nonexistent");
        expect(result.snapshot).toBeNull();
    });

    test("loadSnapshotFromHub passes on other API errors", async () => {
        const error = new JaiaRESTAPIError(APIErrorCode.API_ERROR__INVALID_RECORD_NAME, "Bad name");
        mockRequest.mockRejectedValue(error);
        await expect(loadSnapshotFromHub("../escape")).rejects.toBe(error);
    });

    test("saveToHub waits for the hub to save", async () => {
        const error = new Error("Hub unreachable");
        mockRequest.mockRejectedValue(error);
        await expect(saveToHub("my-zones")).rejects.toBe(error);
    });

    test("deleteFromHub calls the API with the correct name", async () => {
        mockRequest.mockResolvedValue({});
        await deleteFromHub("my-zones");
        expect(mockRequest.mock.calls[0][0].record_query.delete_name).toBe("my-zones");
    });
});

describe("Zone file import", () => {
    /** Feeds a JSON file to importZonesFromFile through a mocked file input. */
    async function importFile(content: object) {
        const fileContent = JSON.stringify(content);
        const file = new File([fileContent], "zones.json", { type: "application/json" });
        (file as any).text = () => Promise.resolve(fileContent);
        const mockInput = document.createElement("input");
        jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput);
        const resultPromise = importZonesFromFile();
        Object.defineProperty(mockInput, "files", { value: [file] });
        mockInput.dispatchEvent(new Event("change"));
        return resultPromise;
    }

    const snapshot: ExclusionZoneSetSnapshot = { zones: [], nextZoneID: 1, name: "zones" };

    test("imports a file of the current version", async () => {
        const result = await importFile({ version: EXCLUSION_ZONE_SET_VERSION, snapshot });

        expect(result).toEqual({ snapshot, resultType: ZoneLoadResultType.SUCCESS });
    });

    test("refuses a file with a version it does not know", async () => {
        const result = await importFile({ version: "9.9", snapshot });

        expect(result).toEqual({ snapshot: null, resultType: ZoneLoadResultType.UNKNOWN_FORMAT });
    });

    test("reports a file without a version as an invalid format", async () => {
        const result = await importFile({ snapshot });

        expect(result.resultType).toBe(ZoneLoadResultType.INVALID_FORMAT);
    });
});

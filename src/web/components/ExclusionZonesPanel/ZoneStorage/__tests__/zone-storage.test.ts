import {
    exclusionZoneSet,
    ExclusionZoneSetSnapshot,
} from "../../../../data/exclusion_zones/exclusion-zone-set";
import {
    listSavedZoneSetsFromHub,
    saveToHub,
    loadSnapshotFromHub,
    deleteFromHub,
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
        expect(JSON.parse(query.save_content).zones.length).toBe(1);
    });

    test("loadSnapshotFromHub returns a snapshot from the hub", async () => {
        const fakeSnapshot: ExclusionZoneSetSnapshot = { zones: [], nextZoneID: 1 };
        mockRequest.mockResolvedValue({
            record_query_response: { content: JSON.stringify(fakeSnapshot) },
        });

        const result = await loadSnapshotFromHub("my-zones");
        expect(result).toEqual(fakeSnapshot);
        expect(mockRequest.mock.calls[0][0].record_query.get_name).toBe("my-zones");
    });

    test("loadSnapshotFromHub returns null when the hub has no entry", async () => {
        mockRequest.mockRejectedValue(
            new JaiaRESTAPIError(APIErrorCode.API_ERROR__RECORD_NOT_FOUND, "Record not found"),
        );
        const result = await loadSnapshotFromHub("nonexistent");
        expect(result).toBeNull();
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

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

jest.mock("../../../../utils/jaia-api", () => ({
    jaiaAPI: {
        listExclusionZones: jest.fn(),
        saveExclusionZone: jest.fn(),
        loadExclusionZone: jest.fn(),
        deleteExclusionZone: jest.fn(),
    },
}));

import { jaiaAPI } from "../../../../utils/jaia-api";

const mockJaiaAPI = jaiaAPI as jest.Mocked<typeof jaiaAPI>;

describe("Zone hub storage", () => {
    beforeEach(() => {
        exclusionZoneSet.clearZones();
        jest.clearAllMocks();
    });

    test("listSavedZoneSetsFromHub returns names from the hub", async () => {
        mockJaiaAPI.listExclusionZones.mockResolvedValue(["zone-a", "zone-b"]);
        const names = await listSavedZoneSetsFromHub();
        expect(names).toEqual(["zone-a", "zone-b"]);
        expect(mockJaiaAPI.listExclusionZones).toHaveBeenCalledTimes(1);
    });

    test("saveToHub calls the API with the current zone set snapshot", async () => {
        exclusionZoneSet.addZone({
            vertices: [
                { lat: 41.0, lon: -72.0 },
                { lat: 41.001, lon: -72.0 },
                { lat: 41.001, lon: -71.999 },
            ],
        });
        mockJaiaAPI.saveExclusionZone.mockResolvedValue(undefined);

        await saveToHub("my-zones");

        expect(mockJaiaAPI.saveExclusionZone).toHaveBeenCalledTimes(1);
        const [name, snapshot] = mockJaiaAPI.saveExclusionZone.mock.calls[0];
        expect(name).toBe("my-zones");
        expect(snapshot.zones.length).toBe(1);
    });

    test("loadSnapshotFromHub returns a snapshot from the hub", async () => {
        const fakeSnapshot: ExclusionZoneSetSnapshot = { zones: [], nextZoneID: 1 };
        mockJaiaAPI.loadExclusionZone.mockResolvedValue(fakeSnapshot);

        const result = await loadSnapshotFromHub("my-zones");
        expect(result).toEqual(fakeSnapshot);
        expect(mockJaiaAPI.loadExclusionZone).toHaveBeenCalledWith("my-zones");
    });

    test("loadSnapshotFromHub returns null when the hub has no entry", async () => {
        mockJaiaAPI.loadExclusionZone.mockResolvedValue(null);
        const result = await loadSnapshotFromHub("nonexistent");
        expect(result).toBeNull();
    });

    test("deleteFromHub calls the API with the correct name", async () => {
        mockJaiaAPI.deleteExclusionZone.mockResolvedValue(undefined);
        await deleteFromHub("my-zones");
        expect(mockJaiaAPI.deleteExclusionZone).toHaveBeenCalledWith("my-zones");
    });
});

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
        expect(snapshot.version).toBe(EXCLUSION_ZONE_SET_VERSION);
    });

    test("saveToHub stores the set under the name the snapshot carries", async () => {
        exclusionZoneSet.setName("old-name");
        mockJaiaAPI.saveExclusionZone.mockResolvedValue(undefined);

        await saveToHub("new-name");

        const [name, snapshot] = mockJaiaAPI.saveExclusionZone.mock.calls[0];
        expect(name).toBe("new-name");
        expect(snapshot.name).toBe("new-name");
        expect(exclusionZoneSet.getName()).toBe("new-name");
    });

    test("loadSnapshotFromHub falls back to the requested name for an entry saved without one", async () => {
        mockJaiaAPI.loadExclusionZone.mockResolvedValue({ zones: [], nextZoneID: 1 });

        const result = await loadSnapshotFromHub("my-zones");

        expect(result.snapshot!.name).toBe("my-zones");
    });

    test("loadSnapshotFromHub returns a snapshot from the hub", async () => {
        const fakeSnapshot: ExclusionZoneSetSnapshot = {
            zones: [],
            nextZoneID: 1,
            name: "my-zones",
        };
        mockJaiaAPI.loadExclusionZone.mockResolvedValue({
            ...fakeSnapshot,
            version: EXCLUSION_ZONE_SET_VERSION,
        });

        const result = await loadSnapshotFromHub("my-zones");
        expect(result).toEqual({ snapshot: fakeSnapshot, resultType: ZoneLoadResultType.SUCCESS });
        expect(mockJaiaAPI.loadExclusionZone).toHaveBeenCalledWith("my-zones");
    });

    test("loadSnapshotFromHub reads an entry saved without a version as 1.0", async () => {
        mockJaiaAPI.loadExclusionZone.mockResolvedValue({ zones: [], nextZoneID: 1, name: "a" });

        const result = await loadSnapshotFromHub("a");

        expect(result.resultType).toBe(ZoneLoadResultType.SUCCESS);
    });

    test("loadSnapshotFromHub refuses a version it does not know", async () => {
        mockJaiaAPI.loadExclusionZone.mockResolvedValue({
            zones: [],
            nextZoneID: 1,
            name: "newer",
            version: "9.9",
        });

        const result = await loadSnapshotFromHub("newer");

        expect(result).toEqual({ snapshot: null, resultType: ZoneLoadResultType.UNKNOWN_FORMAT });
    });

    test("loadSnapshotFromHub reports nothing loaded when the hub has no entry", async () => {
        mockJaiaAPI.loadExclusionZone.mockResolvedValue(null);
        const result = await loadSnapshotFromHub("nonexistent");
        expect(result.snapshot).toBeNull();
    });

    test("deleteFromHub calls the API with the correct name", async () => {
        mockJaiaAPI.deleteExclusionZone.mockResolvedValue(undefined);
        await deleteFromHub("my-zones");
        expect(mockJaiaAPI.deleteExclusionZone).toHaveBeenCalledWith("my-zones");
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

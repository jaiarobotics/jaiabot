import { ExclusionZone, ExclusionZoneSet } from "../exclusion-zone-set";
import { GeographicCoordinate } from "../../../shared/proto/jaiabot/messages/geographic_coordinate";

function coord(lat: number, lon: number): GeographicCoordinate {
    return { lat, lon };
}

function squareZone(lat = 41.0, lon = -72.0, halfSide = 0.0003): ExclusionZone {
    return {
        vertices: [
            coord(lat - halfSide, lon - halfSide),
            coord(lat - halfSide, lon + halfSide),
            coord(lat + halfSide, lon + halfSide),
            coord(lat + halfSide, lon - halfSide),
        ],
    };
}

describe("ExclusionZoneSet — zone CRUD", () => {
    let zoneSet: ExclusionZoneSet;

    beforeEach(() => {
        zoneSet = new ExclusionZoneSet();
    });

    test("addZone assigns sequential IDs starting at 1", () => {
        const id1 = zoneSet.addZone(squareZone());
        const id2 = zoneSet.addZone(squareZone(42.0, -73.0));
        expect(id1).toBe(1);
        expect(id2).toBe(2);
    });

    test("getZone retrieves a zone by ID", () => {
        const zone = squareZone();
        const id = zoneSet.addZone(zone);
        expect(zoneSet.getZone(id)).toEqual(zone);
    });

    test("getZone returns undefined for an unknown ID", () => {
        expect(zoneSet.getZone(999)).toBeUndefined();
    });

    test("getZones returns all added zones", () => {
        zoneSet.addZone(squareZone());
        zoneSet.addZone(squareZone(42.0, -73.0));
        expect(zoneSet.getZones().size).toBe(2);
    });

    test("updateZone replaces the zone at a given ID", () => {
        const id = zoneSet.addZone(squareZone());
        const updated = squareZone(42.0, -73.0);
        zoneSet.updateZone(id, updated);
        expect(zoneSet.getZone(id)).toEqual(updated);
    });

    test("deleteZone removes a zone", () => {
        const id = zoneSet.addZone(squareZone());
        zoneSet.deleteZone(id);
        expect(zoneSet.getZone(id)).toBeUndefined();
        expect(zoneSet.getZones().size).toBe(0);
    });

    test("clearZones removes all zones and resets the ID counter", () => {
        zoneSet.addZone(squareZone());
        zoneSet.addZone(squareZone(42.0, -73.0));
        zoneSet.clearZones();
        expect(zoneSet.getZones().size).toBe(0);
        const newID = zoneSet.addZone(squareZone());
        expect(newID).toBe(1);
    });
});

describe("ExclusionZoneSet — name", () => {
    let zoneSet: ExclusionZoneSet;

    beforeEach(() => {
        zoneSet = new ExclusionZoneSet();
    });

    test("getName returns an empty string by default", () => {
        expect(zoneSet.getName()).toBe("");
    });

    test("setName / getName round-trip", () => {
        zoneSet.setName("coastal-exclusions");
        expect(zoneSet.getName()).toBe("coastal-exclusions");
    });

    test("clearZones resets the name", () => {
        zoneSet.setName("test-zones");
        zoneSet.clearZones();
        expect(zoneSet.getName()).toBe("");
    });
});

describe("ExclusionZoneSet — vertex operations", () => {
    let zoneSet: ExclusionZoneSet;

    beforeEach(() => {
        zoneSet = new ExclusionZoneSet();
    });

    test("moveVertex updates the vertex at the given index", () => {
        const id = zoneSet.addZone(squareZone());
        const newLoc = coord(41.001, -72.001);
        zoneSet.moveVertex(id, 0, newLoc);
        expect(zoneSet.getZone(id)!.vertices![0]).toEqual(newLoc);
    });

    test("moveVertex does not affect other vertices", () => {
        const zone = squareZone();
        const id = zoneSet.addZone(zone);
        const original1 = { ...zone.vertices![1] };
        zoneSet.moveVertex(id, 0, coord(99, 99));
        expect(zoneSet.getZone(id)!.vertices![1]).toEqual(original1);
    });

    test("moveVertex returns the same index", () => {
        const id = zoneSet.addZone(squareZone());
        expect(zoneSet.moveVertex(id, 2, coord(41.001, -72.001))).toBe(2);
    });

    test("addVertex appends a vertex and returns its index", () => {
        const id = zoneSet.addZone(squareZone()); // 4 vertices
        const newLoc = coord(41.005, -72.005);
        const idx = zoneSet.addVertex(id, newLoc);
        expect(idx).toBe(4);
        expect(zoneSet.getZone(id)!.vertices!.length).toBe(5);
        expect(zoneSet.getZone(id)!.vertices![4]).toEqual(newLoc);
    });

    test("addVertex returns -1 for a zone with fewer than 3 vertices", () => {
        const id = zoneSet.addZone({ vertices: [coord(1, 1), coord(2, 2)] });
        expect(zoneSet.addVertex(id, coord(3, 3))).toBe(-1);
    });

    test("addVertex returns -1 for an unknown zone ID", () => {
        expect(zoneSet.addVertex(999, coord(1, 1))).toBe(-1);
    });
});

describe("ExclusionZoneSet — snapshot", () => {
    let zoneSet: ExclusionZoneSet;

    beforeEach(() => {
        zoneSet = new ExclusionZoneSet();
    });

    test("captureSnapshot / restoreFromSnapshot round-trips zones", () => {
        const zone1 = squareZone(41.0, -72.0);
        const zone2 = squareZone(42.0, -73.0);
        zoneSet.addZone(zone1);
        zoneSet.addZone(zone2);

        const snapshot = zoneSet.captureSnapshot();
        const fresh = new ExclusionZoneSet();
        fresh.restoreFromSnapshot(snapshot);

        expect(fresh.getZones().size).toBe(2);
        expect(fresh.getZone(1)).toEqual(zone1);
        expect(fresh.getZone(2)).toEqual(zone2);
    });

    test("restoreFromSnapshot preserves nextZoneID so new zones get the correct ID", () => {
        zoneSet.addZone(squareZone());
        zoneSet.addZone(squareZone(42.0, -73.0));
        const snapshot = zoneSet.captureSnapshot();

        const fresh = new ExclusionZoneSet();
        fresh.restoreFromSnapshot(snapshot);
        const newID = fresh.addZone(squareZone(43.0, -74.0));
        expect(newID).toBe(3);
    });

    test("snapshot is a deep copy — mutating the original does not affect the snapshot", () => {
        const id = zoneSet.addZone(squareZone());
        const snapshot = zoneSet.captureSnapshot();
        zoneSet.moveVertex(id, 0, coord(99, 99));
        expect(snapshot.zones[0][1].vertices![0]).not.toEqual(coord(99, 99));
    });
});

import Mission from "../../../data/mission_set/mission";
import { ExclusionZone } from "../../../data/exclusion_zones/exclusion-zone-set";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { MAX_WAYPOINTS } from "../../constants";
import { checkPlacement } from "../placement";

function coord(lat: number, lon: number): GeographicCoordinate {
    return { lat, lon };
}

const ZONES = new Map<number, ExclusionZone>([
    [
        1,
        {
            vertices: [
                coord(40.9995, -72.0005),
                coord(40.9995, -71.9995),
                coord(41.0005, -71.9995),
                coord(41.0005, -72.0005),
            ],
        },
    ],
]);
const INSIDE = coord(41.0, -72.0);
const CLEAR = coord(41.01, -72.01);

function missionOf(count: number): Mission {
    const mission = new Mission();
    for (let i = 0; i < count; i++) mission.addWaypoint(CLEAR);
    return mission;
}

const ALLOWED = { kind: "allowed" };
const refused = (message: RegExp) => ({ kind: "refused", message: expect.stringMatching(message) });

describe("checkPlacement", () => {
    test("allows a location clear of every zone", () => {
        expect(checkPlacement(CLEAR, ZONES)).toEqual(ALLOWED);
    });

    test("refuses a location inside a zone", () => {
        expect(checkPlacement(INSIDE, ZONES)).toEqual(refused(/exclusion zone/));
    });

    test("refuses a location in a zone's safety buffer", () => {
        // 2 m east of the zone's east edge, inside the 5 m buffer
        expect(checkPlacement(coord(41.0, -71.9995 + 0.000024), ZONES)).toEqual(
            refused(/exclusion zone/),
        );
    });

    test("refuses appending to a mission at the waypoint limit", () => {
        expect(checkPlacement(CLEAR, ZONES, missionOf(MAX_WAYPOINTS))).toEqual(refused(/maximum/));
    });

    test("allows appending to a mission below the limit", () => {
        expect(checkPlacement(CLEAR, ZONES, missionOf(MAX_WAYPOINTS - 1))).toEqual(ALLOWED);
    });

    test("does not count suppressed waypoints toward the limit", () => {
        const mission = Mission.fromJSON({
            waypoints: Array.from({ length: MAX_WAYPOINTS }, (_, i) => ({
                location: CLEAR,
                isSuppressed: i === 0,
            })),
        } as any);

        expect(checkPlacement(CLEAR, ZONES, mission)).toEqual(ALLOWED);
    });
});

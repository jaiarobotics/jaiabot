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
const confirm = (message: string) => ({ kind: "confirm", message });
const refused = (message: RegExp) => ({ kind: "refused", message: expect.stringMatching(message) });
const INSIDE_MESSAGE = "This point is inside an exclusion zone or its safety margin.";
const WAYPOINT_INSIDE_MESSAGE = `${INSIDE_MESSAGE} A reroute will take it out of the path.`;

describe("checkPlacement", () => {
    test("allows a location clear of every zone", () => {
        expect(checkPlacement(CLEAR, ZONES, "waypoint")).toEqual(ALLOWED);
    });

    test("asks to confirm a waypoint inside a zone, saying a reroute takes it out", () => {
        expect(checkPlacement(INSIDE, ZONES, "waypoint")).toEqual(confirm(WAYPOINT_INSIDE_MESSAGE));
    });

    test.each(["rallyPoint", "surveyCorner"] as const)(
        "asks to confirm a %s inside a zone, without the reroute sentence",
        (point) => {
            expect(checkPlacement(INSIDE, ZONES, point)).toEqual(confirm(INSIDE_MESSAGE));
        },
    );

    test("asks to confirm a location in a zone's safety margin", () => {
        // 2 m east of the zone's east edge, inside the 5 m margin
        expect(checkPlacement(coord(41.0, -71.9995 + 0.000024), ZONES, "waypoint")).toEqual(
            confirm(WAYPOINT_INSIDE_MESSAGE),
        );
    });

    test("refuses appending to a mission at the waypoint limit", () => {
        expect(checkPlacement(CLEAR, ZONES, "waypoint", missionOf(MAX_WAYPOINTS))).toEqual(
            refused(/maximum/),
        );
    });

    test("refuses at the waypoint limit even inside a zone", () => {
        expect(checkPlacement(INSIDE, ZONES, "waypoint", missionOf(MAX_WAYPOINTS))).toEqual(
            refused(/maximum/),
        );
    });

    test("allows appending to a mission below the limit", () => {
        expect(checkPlacement(CLEAR, ZONES, "waypoint", missionOf(MAX_WAYPOINTS - 1))).toEqual(
            ALLOWED,
        );
    });

    test("does not count suppressed waypoints toward the limit", () => {
        const mission = Mission.fromJSON({
            waypoints: Array.from({ length: MAX_WAYPOINTS }, (_, i) => ({
                location: CLEAR,
                isSuppressed: i === 0,
            })),
        } as any);

        expect(checkPlacement(CLEAR, ZONES, "waypoint", mission)).toEqual(ALLOWED);
    });
});

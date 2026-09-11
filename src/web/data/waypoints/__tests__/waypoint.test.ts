import Waypoint from "../waypoint";
import { MAX_LAT, MAX_LON, MGRS_PLACEHOLDER, MIN_LAT, MIN_LON } from "../../../utils/constants";

const locations = [
    {
        name: "White House",
        lat: 38.89796,
        lon: -77.03656,
        mgrs: "18SUJ2338907424",
        components: {
            gridZoneDesignator: "18S",
            squareIdentifier: "UJ",
            easting: "23389",
            northing: "07424",
        },
    },
    {
        name: "Sydney Opera House",
        lat: -33.8568,
        lon: 151.2153,
        mgrs: "56HLH3490052288",
        components: {
            gridZoneDesignator: "56H",
            squareIdentifier: "LH",
            easting: "34900",
            northing: "52288",
        },
    },
    {
        name: "Null Island",
        lat: 0,
        lon: 0,
        mgrs: "31NAA6602100000",
        components: {
            gridZoneDesignator: "31N",
            squareIdentifier: "AA",
            easting: "66021",
            northing: "00000",
        },
    },
    {
        name: "Fiji near the International Date Line",
        lat: -16.5,
        lon: 179.9,
        mgrs: "60KZG0960373529",
        components: {
            gridZoneDesignator: "60K",
            squareIdentifier: "ZG",
            easting: "09603",
            northing: "73529",
        },
    },
    {
        name: "Aleutians near the International Date Line",
        lat: 51.9,
        lon: -179.9,
        mgrs: "1UCT0049053890",
        components: {
            gridZoneDesignator: "1U",
            squareIdentifier: "CT",
            easting: "00490",
            northing: "53890",
        },
    },
    {
        name: "Svalbard",
        lat: 78.2232,
        lon: 15.6333,
        mgrs: "33XWG1442983357",
        components: {
            gridZoneDesignator: "33X",
            squareIdentifier: "WG",
            easting: "14429",
            northing: "83357",
        },
    },
    {
        name: "Tromso Norway",
        lat: 69.6492,
        lon: 18.9553,
        mgrs: "34WDC2065328081",
        components: {
            gridZoneDesignator: "34W",
            squareIdentifier: "DC",
            easting: "20653",
            northing: "28081",
        },
    },
    {
        name: "near the northern MGRS latitude limit",
        lat: 83.9,
        lon: 0,
        mgrs: "31XDP6442417856",
        components: {
            gridZoneDesignator: "31X",
            squareIdentifier: "DP",
            easting: "64424",
            northing: "17856",
        },
    },
    {
        name: "near the southern MGRS latitude limit",
        lat: -79.9,
        lon: 10,
        mgrs: "32CNS1957629407",
        components: {
            gridZoneDesignator: "32C",
            squareIdentifier: "NS",
            easting: "19576",
            northing: "29407",
        },
    },
];

function expectLonLatCloseTo(
    actual: number[],
    expected: { lon: number; lat: number },
    precision = 4,
) {
    expect(actual[0]).toBeCloseTo(expected.lon, precision);
    expect(actual[1]).toBeCloseTo(expected.lat, precision);
}

describe("Waypoint lat/lon and MGRS conversion", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("latLonToMGRS", () => {
        test.each(locations)("converts $name lat/lon to MGRS components", (location) => {
            const waypoint = new Waypoint();
            waypoint.setLocation({ lat: location.lat, lon: location.lon });

            expect(waypoint.latLonToMGRS()).toEqual(location.components);
        });

        test("clamps coordinates above the supported MGRS bounds", () => {
            const waypoint = new Waypoint();
            waypoint.setLocation({ lat: MAX_LAT + 1, lon: MAX_LON + 1 });

            const clampedWaypoint = new Waypoint();
            clampedWaypoint.setLocation({ lat: MAX_LAT, lon: MAX_LON });

            expect(waypoint.latLonToMGRS()).toEqual(clampedWaypoint.latLonToMGRS());
        });

        test("clamps coordinates below the supported MGRS bounds", () => {
            const waypoint = new Waypoint();
            waypoint.setLocation({ lat: MIN_LAT - 1, lon: MIN_LON - 1 });

            const clampedWaypoint = new Waypoint();
            clampedWaypoint.setLocation({ lat: MIN_LAT, lon: MIN_LON });

            expect(waypoint.latLonToMGRS()).toEqual(clampedWaypoint.latLonToMGRS());
        });

        test("returns placeholder MGRS components when latitude is invalid", () => {
            const waypoint = new Waypoint();
            waypoint.setLocation({ lat: Number.NaN, lon: -77.03656 });

            expect(waypoint.latLonToMGRS()).toEqual({
                gridZoneDesignator: MGRS_PLACEHOLDER,
                squareIdentifier: MGRS_PLACEHOLDER,
                easting: MGRS_PLACEHOLDER,
                northing: MGRS_PLACEHOLDER,
            });
        });

        test("returns placeholder MGRS components when longitude is invalid", () => {
            const waypoint = new Waypoint();
            waypoint.setLocation({ lat: 38.89796, lon: Number.NaN });

            expect(waypoint.latLonToMGRS()).toEqual({
                gridZoneDesignator: MGRS_PLACEHOLDER,
                squareIdentifier: MGRS_PLACEHOLDER,
                easting: MGRS_PLACEHOLDER,
                northing: MGRS_PLACEHOLDER,
            });
        });
    });

    describe("mgrsToLonLat", () => {
        test.each(locations)("converts $name MGRS to lon/lat", (location) => {
            const waypoint = new Waypoint();

            expectLonLatCloseTo(waypoint.mgrsToLonLat(location.mgrs), location);
        });

        test.each(["", "UJ2338907424", "99ZUJ2338907424", "not-a-grid"])(
            "returns NaN coordinates for invalid MGRS input: %s",
            (mgrs) => {
                jest.spyOn(console, "error").mockImplementation(() => {});

                const waypoint = new Waypoint();
                const [lon, lat] = waypoint.mgrsToLonLat(mgrs);

                expect(Number.isNaN(lon)).toBe(true);
                expect(Number.isNaN(lat)).toBe(true);
            },
        );
    });

    describe("switching between formats", () => {
        test.each(locations)("round-trips $name from lat/lon to MGRS and back", (location) => {
            const waypoint = new Waypoint();
            waypoint.setLocation({ lat: location.lat, lon: location.lon });

            const mgrs = waypoint.latLonToMGRS();
            const mgrsString = [
                mgrs.gridZoneDesignator,
                mgrs.squareIdentifier,
                mgrs.easting,
                mgrs.northing,
            ].join("");

            expectLonLatCloseTo(waypoint.mgrsToLonLat(mgrsString), location);
        });

        test.each(locations)("round-trips $name from MGRS to lat/lon and back", (location) => {
            const waypoint = new Waypoint();
            const [lon, lat] = waypoint.mgrsToLonLat(location.mgrs);

            waypoint.setLocation({ lat, lon });

            expect(waypoint.latLonToMGRS()).toEqual(location.components);
        });
    });
});

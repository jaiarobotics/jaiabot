import { LineString } from "ol/geom";
import { Map } from "ol";
import { toLonLat } from "ol/proj";
import { createMissionFeatures } from "../MissionFeatures";
import { MissionPlan, TaskType } from "../JAIAProtobuf";
import { PortalBotStatus } from "../PortalStatus";

const map = {
    getView: () => ({
        getProjection: () => "EPSG:3857",
    }),
} as unknown as Map;

const bot: PortalBotStatus = {
    bot_id: 1,
};

function getConstantHeadingFeature(features: any[]) {
    return features.find((feature) => feature.get("isConstantHeading"));
}

describe("createMissionFeatures constant heading defaults", () => {
    test("handles missing constant heading speed/time without throwing and creates zero-length heading segment", () => {
        const plan: MissionPlan = {
            goal: [
                {
                    location: { lon: -71.0, lat: 42.0 },
                    task: {
                        type: TaskType.CONSTANT_HEADING,
                        constant_heading: {
                            constant_heading: 90,
                        },
                    },
                },
            ],
        };

        expect(() => createMissionFeatures(map, bot, plan, 0, false, false)).not.toThrow();

        const features = createMissionFeatures(map, bot, plan, 0, false, false);
        const constantHeadingFeature = getConstantHeadingFeature(features);
        expect(constantHeadingFeature).toBeDefined();

        const geometry = constantHeadingFeature.getGeometry() as LineString;
        const [start, end] = geometry.getCoordinates();
        expect(start[0]).toBeCloseTo(end[0], 10);
        expect(start[1]).toBeCloseTo(end[1], 10);
    });

    test("uses configured constant heading speed/time for heading endpoint and mission leg start", () => {
        const plan: MissionPlan = {
            goal: [
                {
                    location: { lon: -71.0, lat: 42.0 },
                    task: {
                        type: TaskType.CONSTANT_HEADING,
                        constant_heading: {
                            constant_heading: 90,
                            constant_heading_speed: 2,
                            constant_heading_time: 30,
                        },
                    },
                },
                {
                    location: { lon: -70.999, lat: 42.0 },
                },
            ],
        };

        const features = createMissionFeatures(map, bot, plan, 0, false, false);
        const constantHeadingFeature = getConstantHeadingFeature(features);
        expect(constantHeadingFeature).toBeDefined();

        const constantHeadingGeometry = constantHeadingFeature.getGeometry() as LineString;
        const [segmentStart, segmentEnd] = constantHeadingGeometry.getCoordinates();
        expect(segmentStart[0]).not.toBeCloseTo(segmentEnd[0], 10);

        const missionLineFeature = features.find((feature) => feature.get("type") === "line");
        expect(missionLineFeature).toBeDefined();

        const missionLineGeometry = missionLineFeature.getGeometry() as LineString;
        const [missionStart] = missionLineGeometry.getCoordinates();
        expect(missionStart[0]).toBeCloseTo(segmentEnd[0], 10);
        expect(missionStart[1]).toBeCloseTo(segmentEnd[1], 10);

        const [startLon] = toLonLat(segmentStart, "EPSG:3857");
        const [endLon] = toLonLat(segmentEnd, "EPSG:3857");
        expect(endLon).toBeGreaterThan(startLon);
    });

    test("skips constant heading segment when heading is not finite", () => {
        const plan: MissionPlan = {
            goal: [
                {
                    location: { lon: -71.0, lat: 42.0 },
                    task: {
                        type: TaskType.CONSTANT_HEADING,
                        constant_heading: {
                            constant_heading: Number.NaN,
                            constant_heading_speed: 2,
                            constant_heading_time: 30,
                        },
                    },
                },
                {
                    location: { lon: -70.999, lat: 42.0 },
                },
            ],
        };

        const features = createMissionFeatures(map, bot, plan, 0, false, false);
        expect(getConstantHeadingFeature(features)).toBeUndefined();

        const missionLineFeature = features.find((feature) => feature.get("type") === "line");
        expect(missionLineFeature).toBeDefined();

        const missionLineGeometry = missionLineFeature.getGeometry() as LineString;
        const [missionStart] = missionLineGeometry.getCoordinates();
        const [missionStartLon, missionStartLat] = toLonLat(missionStart, "EPSG:3857");
        expect(missionStartLon).toBeCloseTo(-71.0, 6);
        expect(missionStartLat).toBeCloseTo(42.0, 6);
    });
});

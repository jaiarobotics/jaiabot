import { Style } from "ol/style";
import Mission from "../../../data/mission_set/mission";
import { generateMissionFlagFeature, generateWaypointFeature } from "../waypoint-feature";
import { ghostMissionFromPlan } from "../../../utils/ghost-missions";
import { MapFeatureTypes } from "../../../types/openlayers-types";

const location = { lat: 41.66, lon: -71.27 };

function makeMission(missionID: number) {
    const mission = new Mission();
    mission.setMissionID(missionID);
    mission.addWaypoint(location);
    return mission;
}

const ghostMission = ghostMissionFromPlan(3, { goal: [{ location }] });

function flagLabel(mission: Mission) {
    const style = generateMissionFlagFeature(location, mission).getStyle() as Style;
    return style.getText().getText();
}

describe("mission flag", () => {
    test("shows the mission number on a mission", () => {
        expect(flagLabel(makeMission(5))).toBe("M5");
    });

    test("shows the bot ID on a ghost", () => {
        expect(flagLabel(ghostMission)).toBe("B3");
    });
});

describe("waypoint feature", () => {
    test("a mission's waypoint responds to clicks", () => {
        const feature = generateWaypointFeature(location, 1, makeMission(5));

        expect(feature.get("type")).toBe(MapFeatureTypes.WAYPOINT);
        expect(feature.get("missionID")).toBe(5);
    });

    test("a ghost's waypoint does not respond to clicks", () => {
        const feature = generateWaypointFeature(location, 1, ghostMission);

        expect(feature.get("type")).toBeUndefined();
        expect(feature.get("missionID")).toBeUndefined();
    });
});

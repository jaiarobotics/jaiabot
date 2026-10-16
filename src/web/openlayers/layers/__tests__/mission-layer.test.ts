import { Feature } from "ol";
import { asArray } from "ol/color";
import { Icon, Style } from "ol/style";

import { ghostMissionLayer, missionLayer } from "../vector/mission-layer";
import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { OpenLayersColors } from "../../../style/openlayers/colors";
import { MapFeatureTypes } from "../../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
import { buildZoneGeometry, isLocationBlocked } from "../../../utils/routing/router";
import {
    coord,
    resetHandlerSingletons,
    squareZone,
} from "../../../context/handlers/__tests__/handler-test-utils";

const WEST = coord(41.0, -72.005);
const INSIDE = coord(41.0, -72.0);
// Just east of the zone's east edge: outside the zone, inside its safety margin
const IN_MARGIN = coord(41.0, -71.99948);
const EAST = coord(41.0, -71.995);

function addMission(waypoints: { location: ReturnType<typeof coord>; isDetour?: boolean }[]) {
    const mission = Mission.fromJSON({ waypoints } as any);
    missionSet.addMission(mission);
    // Adding a mission puts it in edit mode
    missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
    return mission;
}

/** Each waypoint marker's label and colour, in waypoint order. */
function markers(layer = missionLayer) {
    return layer
        .getVectorLayer()
        .getSource()
        .getFeatures()
        .filter((feature: Feature) => feature.get("type") === MapFeatureTypes.WAYPOINT)
        .sort((a: Feature, b: Feature) => a.get("waypointNum") - b.get("waypointNum"))
        .map((feature: Feature) => {
            const style = feature.getStyle() as Style;
            return {
                label: style.getText()?.getText(),
                color: (style.getImage() as Icon).getColor(),
            };
        });
}

const color = (name: OpenLayersColors) => asArray(name);

beforeEach(() => {
    resetHandlerSingletons();
    missionSet.deleteAllGhostMissions();
    exclusionZoneSet.addZone(squareZone(41.0, -72.0));
});

describe("mission layer waypoint markers", () => {
    test("number detours like every other waypoint", () => {
        addMission([
            { location: WEST },
            { location: coord(41.001, -72.003), isDetour: true },
            { location: EAST },
        ]);

        missionLayer.updateFeatures();

        expect(markers().map((marker) => marker.label)).toEqual(["1", "2", "3"]);
        expect(markers()[1].color).toEqual(color(OpenLayersColors.DETOUR));
    });

    test("colour a waypoint inside a zone red, detours included", () => {
        addMission([
            { location: WEST },
            { location: INSIDE },
            { location: INSIDE, isDetour: true },
            { location: EAST },
        ]);

        missionLayer.updateFeatures();

        expect(markers().map((marker) => marker.color)).toEqual([
            color(OpenLayersColors.DEFAULT),
            color(OpenLayersColors.BLOCKED),
            color(OpenLayersColors.BLOCKED),
            color(OpenLayersColors.DEFAULT),
        ]);
    });

    test("colour a waypoint inside only the safety margin red", () => {
        const zones = exclusionZoneSet.getZones();
        expect(isLocationBlocked(IN_MARGIN, buildZoneGeometry(zones, 0))).toBe(false);
        addMission([{ location: WEST }, { location: IN_MARGIN }]);

        missionLayer.updateFeatures();

        expect(markers()[1].color).toEqual(color(OpenLayersColors.BLOCKED));
    });

    test("keep the edit-mode colour on a blocked waypoint of the mission being edited", () => {
        const mission = addMission([{ location: WEST }, { location: INSIDE }]);
        missionSet.setMissionIDInEditMode(mission.getMissionID());

        missionLayer.updateFeatures();

        expect(markers()[1].color).toEqual(color(OpenLayersColors.EDIT));
    });

    test("give detours the edit-mode colour in the mission being edited", () => {
        const mission = addMission([
            { location: WEST },
            { location: coord(41.001, -72.003), isDetour: true },
            { location: EAST },
        ]);
        missionSet.setMissionIDInEditMode(mission.getMissionID());

        missionLayer.updateFeatures();

        expect(markers()[1].color).toEqual(color(OpenLayersColors.EDIT));
    });

    test("leave ghost missions uncoloured", () => {
        const mission = addMission([{ location: WEST }, { location: INSIDE }]);
        missionSet.addGhostMission(mission.getMissionID());

        ghostMissionLayer.updateFeatures();

        expect(markers(ghostMissionLayer)[1].color).toEqual(color(OpenLayersColors.DEFAULT));
    });
});

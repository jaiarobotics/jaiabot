import { Feature } from "ol";
import { asArray } from "ol/color";
import { Icon, Style } from "ol/style";

import { ghostMissionLayer, missionLayer } from "../vector/mission-layer";
import Mission from "../../../data/mission_set/mission";
import { missionSet } from "../../../data/mission_set/mission-set";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { OpenLayersColors } from "../../../style/openlayers/colors";
import { MapFeatureTypes } from "../../../types/openlayers-types";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import { UNASSIGNED_ID } from "../../../utils/constants";
import {
    coord,
    resetHandlerSingletons,
    squareZone,
} from "../../../context/handlers/__tests__/handler-test-utils";

const WEST = coord(41.0, -72.005);
const INSIDE = coord(41.0, -72.0);
// Just east of the zone's east edge
const JUST_OUTSIDE = coord(41.0, -71.99948);
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

/** A route of `count` waypoints heading north from the same start as every other one. */
const route = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ location: coord(41.0 + i * 0.001, -72.01) }));

/** Each waypoint's zIndex keyed "<missionID>:<waypointNum>", and every other feature's. */
function zIndexes() {
    const waypoints = new Map<string, number>();
    const others: number[] = [];
    for (const feature of missionLayer.getVectorLayer().getSource().getFeatures()) {
        const styles = [feature.getStyle()].flat() as Style[];
        if (feature.get("type") === MapFeatureTypes.WAYPOINT) {
            waypoints.set(
                `${feature.get("missionID")}:${feature.get("waypointNum")}`,
                styles[0].getZIndex()!,
            );
        } else {
            others.push(...styles.map((style) => style.getZIndex()!));
        }
    }
    return { waypoints, others };
}

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

    test("leave a waypoint just outside a zone its usual colour", () => {
        addMission([{ location: WEST }, { location: JUST_OUTSIDE }]);

        missionLayer.updateFeatures();

        expect(markers()[1].color).toEqual(color(OpenLayersColors.DEFAULT));
    });

    test("colour a blocked waypoint red in the mission being edited too", () => {
        const mission = addMission([{ location: WEST }, { location: INSIDE }]);
        missionSet.setMissionIDInEditMode(mission.getMissionID());

        missionLayer.updateFeatures();

        expect(markers().map((marker) => marker.color)).toEqual([
            color(OpenLayersColors.EDIT),
            color(OpenLayersColors.BLOCKED),
        ]);
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

    test("give every waypoint its own zIndex, above every line", () => {
        addMission(route(10));
        addMission(route(9));

        missionLayer.updateFeatures();

        const { waypoints, others } = zIndexes();
        expect(waypoints.size).toBe(19);
        expect(new Set(waypoints.values()).size).toBe(19);
        expect(Math.min(...waypoints.values())).toBeGreaterThan(Math.max(...others));
    });

    test("stack the edited mission's selected waypoint, its other waypoints, then the rest", () => {
        const edited = addMission(route(3));
        addMission(route(3));
        missionSet.setMissionIDInEditMode(edited.getMissionID());
        jaiaGlobal.setSelectedWaypoint({
            missionID: edited.getMissionID(),
            waypointNum: 1,
            isMoveable: true,
        });

        missionLayer.updateFeatures();

        const { waypoints } = zIndexes();
        expect(waypoints.get("1:1")).toBeGreaterThan(waypoints.get("1:3")!);
        expect(waypoints.get("1:2")).toBeGreaterThan(waypoints.get("2:3")!);
    });
});

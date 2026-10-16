import { fireEvent, render, screen } from "@testing-library/react";

import { act } from "react";

import { Feature } from "ol";
import { Geometry } from "ol/geom";

import Map from "../Map";
import { JaiaContextProvider } from "../../../context/JaiaContext";

import Mission from "../../../data/mission_set/mission";
import { bots } from "../../../data/bots/bots";
import { hubs } from "../../../data/hubs/hubs";
import { missionSet } from "../../../data/mission_set/mission-set";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { exclusionZoneSet } from "../../../data/exclusion_zones/exclusion-zone-set";
import { rallyPoints } from "../../../data/rally_points/rally-points";
import { gridPlan, GridPlanningStates } from "../../../data/survey_planner/grid-plan";

import { toLonLat } from "ol/proj";

import { map } from "../../../openlayers/maps/map";
import { missionLayer } from "../../../openlayers/layers/vector/mission-layer";
import { gridLayer } from "../../../openlayers/layers/vector/grid-layer";

import { NodeTypes } from "../../../types/jaia-system-types";
import { MapFeatureTypes, MapModes } from "../../../types/openlayers-types";
import { MAX_WAYPOINTS, UNASSIGNED_ID } from "../../../utils/constants";
import { PortalBotStatus, PortalHubStatus } from "../../../shared/PortalStatus";

import { mapBrowserEventMock } from "../../../tests/__mocks__/openlayers/events/map-browser-click.mock";

const mapModule = jest.requireActual("../../../openlayers/maps/map");

const botFeatureMock: Feature<Geometry> = new Feature();
botFeatureMock.set("type", MapFeatureTypes.BOT);
botFeatureMock.set("id", 1);

const hubFeatureMock: Feature<Geometry> = new Feature();
hubFeatureMock.set("type", MapFeatureTypes.HUB);
hubFeatureMock.set("id", 1);

const botStatusMock1: PortalBotStatus = {
    bot_id: 1,
};

const hubStatusMock1: PortalHubStatus = {
    hub_id: 1,
    portalStatusAge: 1,
};

afterEach(() => {
    exclusionZoneSet.clearZones();
    rallyPoints.getRallyPoints().clear();
    gridPlan.reset();
    gridLayer.getVectorLayer().getSource().clear();
    jaiaGlobal.setMapMode(MapModes.DEFAULT);
    missionSet.deleteAllMissions();
    missionsManager.clear();
    missionLayer.getVectorLayer().getSource().clear();
});

beforeEach(() => {
    render(
        <JaiaContextProvider>
            <Map />
        </JaiaContextProvider>,
    );
});

test.skip("Select and deselect Bot and Hub icons on map", () => {
    // Resolve click to being on a Feature of type MapFeatureTypes.BOT
    mapModule.map.forEachFeatureAtPixel = jest.fn().mockReturnValue(botFeatureMock);

    // Bot
    bots.setBot(botStatusMock1);
    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });
    expect(jaiaGlobal.getSelectedNode().type).toBe(NodeTypes.BOT);
    expect(jaiaGlobal.getSelectedNode().id).toBe(1);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });
    expect(jaiaGlobal.getSelectedNode().type).toBe(NodeTypes.NONE);
    expect(jaiaGlobal.getSelectedNode().id).toBe(-1);

    // Hub
    mapModule.map.forEachFeatureAtPixel = jest.fn().mockReturnValue(hubFeatureMock);
    hubs.setHub(hubStatusMock1);
    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });
    expect(jaiaGlobal.getSelectedNode().type).toBe(NodeTypes.HUB);
    expect(jaiaGlobal.getSelectedNode().id).toBe(1);
    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });
    expect(jaiaGlobal.getSelectedNode().type).toBe(NodeTypes.NONE);
    expect(jaiaGlobal.getSelectedNode().id).toBe(-1);

    mapModule.map.forEachFeatureAtPixel = jest.fn().mockReturnValue(undefined);
});

test("Click on map twice with mission in edit mode", () => {
    const mission = new Mission();
    const missionID = missionSet.addMission(mission);
    missionsManager.assign(1, missionID);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    let missionLayerFeatures = missionLayer.getVectorLayer().getSource().getFeatures();
    expect(missionLayerFeatures.length).toBe(2);
    expect(missionLayerFeatures[1].get("type")).toBe(MapFeatureTypes.WAYPOINT);
    expect(missionLayerFeatures[1].get("waypointNum")).toBe(1);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    missionLayerFeatures = missionLayer.getVectorLayer().getSource().getFeatures();
    // 1 flag, 2 waypoints, and a line segment [flag, waypoint, line, waypoint]
    expect(missionLayerFeatures.length).toBe(4);
    expect(missionLayerFeatures[3].get("type")).toBe(MapFeatureTypes.WAYPOINT);
    expect(missionLayerFeatures[3].get("waypointNum")).toBe(2);

    // Reset states
    missionSet.deleteAllMissions();
    missionsManager.clear();
    missionLayer.getVectorLayer().getSource().clear();
});

test("Click on map with no mission in edit mode and no Bot selected", () => {
    expect(missionSet.getMissionIDInEditMode()).toBe(UNASSIGNED_ID);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    expect(missionLayer.getVectorLayer().getSource().getFeatures().length).toBe(0);
});

test("Click on map with Bot selected and not assigned to a mission", () => {
    expect(missionSet.getMissionIDInEditMode()).toBe(UNASSIGNED_ID);

    jaiaGlobal.setSelectedNode({ type: NodeTypes.BOT, id: 1 });

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    let missionLayerFeatures = missionLayer.getVectorLayer().getSource().getFeatures();
    expect(missionLayerFeatures.length).toBe(0);

    jaiaGlobal.setSelectedNode({ type: NodeTypes.NONE, id: UNASSIGNED_ID });
});

describe("a click inside an exclusion zone with a mission in edit mode", () => {
    function clickInsideZone() {
        addZoneUnderClick();
        const missionID = missionSet.addMission(new Mission());
        expect(missionSet.getMissionIDInEditMode()).toBe(missionID);
        act(() => {
            map.dispatchEvent(mapBrowserEventMock);
        });
        return missionSet.getMission(missionID);
    }

    test("asks to confirm before dispatch, saying a reroute takes the waypoint out", () => {
        const mission = clickInsideZone();

        expect(mission.getWaypoints()).toHaveLength(0);
        expect(screen.getByText(/A reroute will take it out of the path/)).toBeTruthy();
    });

    test("adds the waypoint on Place anyway", () => {
        const mission = clickInsideZone();

        fireEvent.click(screen.getByText("Place anyway"));

        expect(mission.getWaypoints()).toHaveLength(1);
        expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
    });

    test("adds nothing on Cancel", () => {
        const mission = clickInsideZone();

        fireEvent.click(screen.getByText("Cancel"));

        expect(mission.getWaypoints()).toHaveLength(0);
        expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
    });
});

/** A zone centred on the location the mocked click resolves to. */
function addZoneUnderClick() {
    const [lon, lat] = toLonLat(mapBrowserEventMock.coordinate);
    const halfSide = 0.001;
    exclusionZoneSet.addZone({
        vertices: [
            { lat: lat - halfSide, lon: lon - halfSide },
            { lat: lat - halfSide, lon: lon + halfSide },
            { lat: lat + halfSide, lon: lon + halfSide },
            { lat: lat + halfSide, lon: lon - halfSide },
        ],
    });
}

test("Tap to move into an exclusion zone asks to confirm before dispatch", () => {
    addZoneUnderClick();
    const mission = new Mission();
    mission.addWaypoint({ lat: 41.0, lon: -72.0 });
    const missionID = missionSet.addMission(mission);
    jaiaGlobal.setSelectedWaypoint({ missionID, waypointNum: 1, isMoveable: true });

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    expect(mission.getWaypoint(1)!.getLocation()).toEqual({ lat: 41.0, lon: -72.0 });
    expect(screen.getByText(/inside an exclusion zone/)).toBeTruthy();

    fireEvent.click(screen.getByText("Place anyway"));
    expect(mission.getWaypoint(1)!.getLocation()).not.toEqual({ lat: 41.0, lon: -72.0 });

    jaiaGlobal.resetSelectedWaypoint();
});

test("Click with the mission at the waypoint limit is refused before dispatch", () => {
    const mission = new Mission();
    for (let i = 0; i < MAX_WAYPOINTS; i++) mission.addWaypoint({ lat: 41.0, lon: -72.0 });
    const missionID = missionSet.addMission(mission);
    expect(missionSet.getMissionIDInEditMode()).toBe(missionID);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    expect(mission.getWaypoints()).toHaveLength(MAX_WAYPOINTS);
    expect(screen.getByText(/maximum of/)).toBeTruthy();
    expect(screen.queryByText("Place anyway")).toBeNull();
});

test("A rally point inside an exclusion zone asks to confirm, without the reroute sentence", () => {
    addZoneUnderClick();
    jaiaGlobal.setMapMode(MapModes.RALLY);
    const before = rallyPoints.getRallyPoints().size;

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    expect(rallyPoints.getRallyPoints().size).toBe(before);
    expect(
        screen.getByText("This point is inside an exclusion zone or its safety margin."),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Place anyway"));
    expect(rallyPoints.getRallyPoints().size).toBe(before + 1);
});

test("A survey corner inside an exclusion zone asks to confirm", () => {
    addZoneUnderClick();
    jaiaGlobal.setMapMode(MapModes.SURVEY_PLANNING);
    gridPlan.setState(GridPlanningStates.ACCEPTING_MISSION_START_LOCATION);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    expect(gridPlan.getState()).toBe(GridPlanningStates.ACCEPTING_MISSION_START_LOCATION);
    expect(
        screen.getByText("This point is inside an exclusion zone or its safety margin."),
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Place anyway"));
    expect(gridPlan.getMissionStart()).toEqual(
        expect.objectContaining({ lat: expect.any(Number) }),
    );
});

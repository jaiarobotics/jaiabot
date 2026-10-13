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

import { toLonLat } from "ol/proj";

import { map } from "../../../openlayers/maps/map";
import { missionLayer } from "../../../openlayers/layers/vector/mission-layer";

import { NodeTypes } from "../../../types/jaia-system-types";
import { MapFeatureTypes } from "../../../types/openlayers-types";
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

test("Click inside an exclusion zone with mission in edit mode is refused before dispatch", () => {
    addZoneUnderClick();
    const missionID = missionSet.addMission(new Mission());
    expect(missionSet.getMissionIDInEditMode()).toBe(missionID);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    expect(missionSet.getMission(missionID).getWaypoints()).toHaveLength(0);
    expect(screen.getByText(/inside an exclusion zone/)).toBeTruthy();

    fireEvent.click(screen.getByText("OK"));
    expect(screen.queryByText(/inside an exclusion zone/)).toBeNull();
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

test("Tap to move into an exclusion zone is refused before dispatch", () => {
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
});

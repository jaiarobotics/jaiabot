import { render } from "@testing-library/react";

import { act } from "react";

import { Feature } from "ol";
import { Geometry } from "ol/geom";

import Map from "../Map";
import { JaiaContextProvider } from "../../../context/Jaia/JaiaContext";

import Mission from "../../../data/missions/mission";
import { bots } from "../../../data/bots/bots";
import { hubs } from "../../../data/hubs/hubs";
import { missions } from "../../../data/missions/missions";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";

import { map } from "../../../openlayers/maps/map";
import { missionLayer } from "../../../openlayers/layers/vector/mission-layer";

import { NodeTypes } from "../../../types/jaia-system-types";
import { MapFeatureTypes } from "../../../types/openlayers-types";
import { UNASSIGNED_ID } from "../../../utils/constants";
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

beforeEach(() => {
    render(
        <JaiaContextProvider>
            <Map />
        </JaiaContextProvider>,
    );
});

test("Select and deselect Bot and Hub icons on map", () => {
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
    missions.addMission(mission);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    let missionLayerFeatures = missionLayer.getVectorLayer().getSource().getFeatures();
    expect(missionLayerFeatures.length).toBe(1);
    expect(missionLayerFeatures[0].get("type")).toBe(MapFeatureTypes.WAYPOINT);
    expect(missionLayerFeatures[0].get("id")).toBe(1);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    missionLayerFeatures = missionLayer.getVectorLayer().getSource().getFeatures();
    // 2 waypoints and a line segment [waypoint, line, waypoint]
    expect(missionLayerFeatures.length).toBe(3);
    expect(missionLayerFeatures[2].get("type")).toBe(MapFeatureTypes.WAYPOINT);
    expect(missionLayerFeatures[2].get("id")).toBe(2);

    // Reset states
    missions.deleteAllMissions();
    missionLayer.getVectorLayer().getSource().clear();
});

test("Click on map with no mission in edit mode and no Bot selected", () => {
    expect(missions.getMissionIDInEditMode()).toBe(UNASSIGNED_ID);

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    expect(missionLayer.getVectorLayer().getSource().getFeatures().length).toBe(0);
});

test("Click on map with Bot selected and not assigned to a mission", () => {
    expect(missions.getMissionIDInEditMode()).toBe(UNASSIGNED_ID);

    jaiaGlobal.setSelectedNode({ type: NodeTypes.BOT, id: 1 });

    act(() => {
        map.dispatchEvent(mapBrowserEventMock);
    });

    let missionLayerFeatures = missionLayer.getVectorLayer().getSource().getFeatures();
    expect(missionLayerFeatures.length).toBe(1);
    expect(missionLayerFeatures[0].get("type")).toBe(MapFeatureTypes.WAYPOINT);
    expect(missionLayerFeatures[0].get("id")).toBe(1);

    expect(missions.getMissionIDInEditMode()).toBe(1);

    // Reset states
    missions.deleteAllMissions();
    missionLayer.getVectorLayer().getSource().clear();
});

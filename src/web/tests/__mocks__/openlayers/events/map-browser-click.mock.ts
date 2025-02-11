import VectorLayer from "ol/layer/Vector";
import { MapBrowserEvent } from "ol";
import { Projection } from "ol/proj";
import { State } from "ol/View";
import { FrameState } from "ol/Map";

import { map } from "../../../../openlayers/maps/map";

const type = "click";
const originalEvent: UIEvent = new UIEvent("select");
const dragging = false;
const projection: Projection = new Projection({
    code: "EPSG:3857",
    units: "m",
    extent: [-20037508.342789244, -20037508.342789244, 20037508.342789244, 20037508.342789244],
    axisOrientation: "enu",
    global: true,
    metersPerUnit: undefined,
    worldExtent: [-180, -85, 180, 85],
    getPointResolution: undefined,
});
const viewState: State = {
    center: [-7934069.465145998, 5110583.896260285],
    nextCenter: null,
    nextResolution: NaN,
    nextRotation: NaN,
    projection: projection,
    resolution: 0.01668348302952946,
    rotation: 0,
    zoom: 23.16163546175011,
};
const frameState: FrameState = {
    pixelRatio: 0,
    time: 0,
    viewState: viewState,
    animate: false,
    coordinateToPixelTransform: [
        59.93952211477772, 0, 0, -59.93952211477772, 475565191.1663012, 306326399.46932024,
    ],
    declutter: null,
    extent: [-7934083.79625792, 5110576.505477303, -7934055.134034076, 5110591.287043267],
    nextExtent: undefined,
    index: 436,
    layerStatesArray: [new VectorLayer().getLayerState()],
    layerIndex: 3,
    pixelToCoordinateTransform: [
        0.01668348302952946, 0, 0, -0.01668348302952946, -7934083.79625792, 5110591.287043266,
    ],
    postRenderFunctions: [],
    size: [1718, 886],
    tileQueue: undefined,
    usedTiles: undefined,
    viewHints: [0, 0],
    wantedTiles: {},
    mapId: "15",
    renderTargets: {},
};

export const mapBrowserEventMock = new MapBrowserEvent<UIEvent>(
    type,
    map,
    originalEvent,
    dragging,
    frameState,
    undefined,
);
mapBrowserEventMock.pixel = [602, 147];

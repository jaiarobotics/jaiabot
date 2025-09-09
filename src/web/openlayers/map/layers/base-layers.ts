import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { XYZ, OSM } from "ol/source";
import { persistVisibility } from "./visible-layer-persistance";
import * as Layers from "../../../shared/Layers";

export const openStreetMapLayer = new TileLayer({
    properties: {
        title: "OpenStreetMap",
    },
    zIndex: 1,
    source: new XYZ({
        url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attributions: "Map data: © OpenStreetMap contributors",
        attributionsCollapsible: false,
    }),
});

export function createBaseLayerGroup() {
    const layers = [Layers.getArcGISSatelliteImageryLayer(), openStreetMapLayer];

    layers.forEach((layer) => persistVisibility(layer));

    return new LayerGroup({
        properties: {
            title: "Base Maps",
            fold: "close",
        },
        layers: layers,
    });
}

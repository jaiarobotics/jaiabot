import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { XYZ, OSM } from "ol/source";
import { persistVisibility } from "./visible-layer-persistance";
import * as Layers from "../../../shared/Layers";
import { loadTileFromDatabase } from "./tile-db";

export const openStreetMapSource = new OSM({ wrapX: false });
openStreetMapSource.setTileLoadFunction(loadTileFromDatabase);

export function createBaseLayerGroup() {
    const layers = [
        Layers.getArcGISSatelliteImageryLayer(),
        new TileLayer({
            properties: {
                title: "OpenStreetMap",
                type: "base",
            },
            zIndex: 1,
            source: openStreetMapSource,
        }),
    ];

    layers.forEach((layer) => persistVisibility(layer));

    return new LayerGroup({
        properties: {
            title: "Base Maps",
            fold: "close",
        },
        layers: layers,
    });
}

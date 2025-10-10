import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { persistVisibility } from "./visible-layer-persistance";
import TileArcGISRest from "ol/source/TileArcGISRest";

export const noaaLayer = new TileLayer({
    properties: { title: "NOAA ENC Charts" },
    opacity: 0.7,
    zIndex: 20,
    source: new TileArcGISRest({
        url: "https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer",
        attributions: "Map data: NOAA ENC® Charts",
        crossOrigin: "anonymous",
    }),
});

export function createChartLayerGroup() {
    // Configure layers
    let layers = [noaaLayer];

    layers.forEach((layer) => {
        persistVisibility(layer);
    });

    return new LayerGroup({
        properties: {
            title: "Bathymetry",
            fold: "close",
        },
        layers: layers,
    });
}

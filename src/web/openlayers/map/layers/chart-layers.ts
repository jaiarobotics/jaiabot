import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS";
import { persistVisibility } from "./visible-layer-persistance";
import { TileArcGISRest } from "ol/source";
import { ImageTile } from "ol";
import { loadTileFromDatabase } from "./tile-db";

const noaaEncSource = new TileArcGISRest({
    url: "https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer",
});

noaaEncSource.setTileLoadFunction(loadTileFromDatabase);

export const gebcoLayer = new TileLayer({
    properties: {
        title: "GEBCO Bathymetry",
    },
    zIndex: 10,
    opacity: 0.7,
    source: new TileWMS({
        url: "https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?",
        params: { LAYERS: "GEBCO_LATEST_2_sub_ice_topo", VERSION: "1.3.0", FORMAT: "image/png" },
        serverType: "mapserver",
        projection: "EPSG:4326",
        wrapX: false,
    }),
});

export const noaaLayer = new TileLayer({
    properties: {
        title: "NOAA ENC Charts",
    },
    opacity: 0.7,
    zIndex: 20,
    source: noaaEncSource,
});

export function createChartLayerGroup() {
    // Configure the basemap layers
    let layers = [noaaLayer, gebcoLayer];

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

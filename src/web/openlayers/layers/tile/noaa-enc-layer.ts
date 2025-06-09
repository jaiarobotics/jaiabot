import TileLayer from "ol/layer/Tile";
import { TileArcGISRest } from "ol/source";

export const noaaENCLayer = new TileLayer({
    properties: {
        title: "noaa-enc-layer",
    },
    source: new TileArcGISRest({
        url: "https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer",
        wrapX: false,
    }),
    visible: false,
});

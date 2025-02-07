import { View } from "ol";

const MERCATOR = "EPSG:3857";

export const view = new View({
    projection: MERCATOR,
    center: [0, 0],
    zoom: 0,
    maxZoom: 24,
});

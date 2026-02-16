import { View } from "ol";
import { MERCATOR } from "../../utils/constants";

export const view = new View({
    projection: MERCATOR,
    center: [0, 0],
    zoom: 0,
    maxZoom: 24,
});

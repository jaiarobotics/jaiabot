import TileLayer from "ol/layer/Tile";
import { XYZ } from "ol/source";
import { OSM_MAX_ZOOM } from "../../../utils/constants";

export const OSMLayer = new TileLayer({
    properties: {
        title: "open-street-map-layer",
    },
    source: new XYZ({
        url: "https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        attributions: "Map data: © OpenStreetMap contributors",
        attributionsCollapsible: false,
        wrapX: false,
        maxZoom: OSM_MAX_ZOOM,
    }),
});

import TileLayer from "ol/layer/Tile";
import { XYZ } from "ol/source";
import { NATURAL_EARTH_MAX_ZOOM } from "../../../utils/constants";

export const NaturalEarthLayer = new TileLayer({
    properties: {
        title: "natural-earth-layer",
    },
    source: new XYZ({
        url: "/maps/natural-earth/{z}/{x}/{y}",
        attributions: "Map data: © Natural Earth contributors",
        attributionsCollapsible: false,
        wrapX: false,
        maxZoom: NATURAL_EARTH_MAX_ZOOM,
    }),
});

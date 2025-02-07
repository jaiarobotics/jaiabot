import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";

export const OSMLayer = new TileLayer({
    properties: {
        title: "open-street-map-layer",
    },
    source: new OSM({ wrapX: false }),
});

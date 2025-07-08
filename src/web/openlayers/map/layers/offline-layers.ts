import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { XYZ } from "ol/source";

export const offlineNOAALayer = new TileLayer({
    properties: {
        title: "Local NOAA ENC charts",
    },
    opacity: 0.7,
    zIndex: 20,
    source: new XYZ({
        url: "/maps/noaa/{z}/{x}/{y}",
    }),
});

export const offlineLayerGroup = new LayerGroup({
    properties: {
        title: "Offline Maps",
        fold: "close",
    },
    layers: [offlineNOAALayer],
});

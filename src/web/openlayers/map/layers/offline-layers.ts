import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { Collection } from "ol";
import { XYZ } from "ol/source";
import { jaiaAPI } from "../../../utils/jaia-api";

const offlineLayerGroup = new LayerGroup({
    properties: {
        title: "Offline Layers",
        fold: "close",
    },
    layers: [],
});

export async function refreshOfflineLayers() {
    jaiaAPI.getOfflineMaps().then((layer_list) => {
        console.error(layer_list);

        const layers = layer_list.map((layer_name) => {
            return new TileLayer({
                properties: {
                    title: layer_name,
                },
                opacity: 0.7,
                zIndex: 20,
                source: new XYZ({
                    url: `/maps/${layer_name}/{z}/{x}/{y}`,
                }),
            });
        });

        offlineLayerGroup.setLayers(new Collection(layers));
    });
}

export function createOfflineLayerGroup() {
    refreshOfflineLayers(); // Initiate a refresh when we create the group
    return offlineLayerGroup;
}

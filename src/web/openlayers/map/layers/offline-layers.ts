import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { Collection } from "ol";
import { XYZ } from "ol/source";
import { jaiaAPI } from "../../../utils/jaia-api";

export const offlineLayerGroup = new LayerGroup({
    properties: {
        title: "Offline Layers",
        fold: "close",
    },
    layers: [],
});

function areSetsEqual<T>(a: Set<T>, b: Set<T>) {
    return a.size === b.size && [...a].every((value) => b.has(value));
}

export async function refreshOfflineLayers() {
    jaiaAPI.getHubMaps().then((hubLayerTitlesArray) => {
        const currentLayerTitles = new Set(
            offlineLayerGroup.getLayersArray().map<string>((layer) => layer.get("title")),
        );
        const hubLayerTitles = new Set(hubLayerTitlesArray);

        if (areSetsEqual(currentLayerTitles, hubLayerTitles)) return;

        const layers = hubLayerTitlesArray.map((layer_name) => {
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

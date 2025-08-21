import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { Collection } from "ol";
import { XYZ } from "ol/source";
import { jaiaAPI } from "../../../utils/jaia-api";

function areSetsEqual<T>(a: Set<T>, b: Set<T>) {
    return a.size === b.size && [...a].every((value) => b.has(value));
}

export class OfflineLayerManager {
    layerGroup = new LayerGroup({
        properties: {
            title: "Offline Layers",
            fold: "close",
        },
        layers: [],
    });

    layerTitles: string[] = [];

    observers: { [key: string]: () => void } = {};

    constructor() {
        setInterval(() => {
            this.refresh();
        }, 2000);
    }

    subscribe(func: () => void, id: string) {
        this.observers[id] = func;
        func();
        return func;
    }

    unsubscribe(id: string) {
        delete this.observers[id];
    }

    notify() {
        Object.values(this.observers).forEach((observer) => {
            observer();
        });
    }

    async refresh() {
        return jaiaAPI.getHubMaps().then((hubLayerTitlesArray) => {
            const hubLayerTitles = new Set(hubLayerTitlesArray);

            if (areSetsEqual(new Set(this.layerTitles), hubLayerTitles)) return;

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

            this.layerGroup.setLayers(new Collection(layers));
            this.layerTitles = this.layerGroup
                .getLayersArray()
                .map((layer) => layer.get("title"))
                .sort();
            this.notify();
        });
    }
}

export const offlineLayerManager = new OfflineLayerManager();

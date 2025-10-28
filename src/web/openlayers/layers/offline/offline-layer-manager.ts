import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { XYZ } from "ol/source";

import { jaiaAPI, MapsDirectory } from "../../../utils/jaia-api";
import { Collection } from "ol";

const REFRESH_INTERVAL = 2000;
const Z_INDEX = 20;

class OfflineLayerManager {
    private layerGroup: LayerGroup;
    private mapsDirectory: MapsDirectory;
    private observers: { [key: string]: () => void };

    constructor() {
        this.layerGroup = new LayerGroup({
            properties: {
                title: "Offline Layers",
            },
            layers: [],
        });
        this.mapsDirectory = null;
        this.observers = {};
        setInterval(() => {
            this.refresh();
        }, REFRESH_INTERVAL);
    }

    getMapsDirectory() {
        return this.mapsDirectory;
    }

    subscribe(hook: () => void, id: string) {
        this.observers[id] = hook;
        hook();
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
        jaiaAPI.getHubMaps().then((mapsDirectory) => {
            const existingOfflineLayers: { [title: string]: TileLayer<XYZ> } = Object.fromEntries(
                this.layerGroup.getLayersArray().map((layer) => [layer.get("title"), layer]),
            );
            const layers =
                mapsDirectory?.maps?.map((map) => {
                    if (map.name in existingOfflineLayers) {
                        return existingOfflineLayers[map.name];
                    }
                    return new TileLayer({
                        properties: {
                            title: map.name,
                        },
                        zIndex: Z_INDEX,
                        visible: false,
                        source: new XYZ({
                            url: `/maps/${map.name}/{z}/{x}/{y}`,
                        }),
                    });
                }) ?? [];
            this.layerGroup.setLayers(new Collection(layers));
            this.mapsDirectory = mapsDirectory;
            this.notify();
        });
    }
}

export const offlineLayerManager = new OfflineLayerManager();

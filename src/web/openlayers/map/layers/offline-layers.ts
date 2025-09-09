import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { Collection } from "ol";
import { XYZ } from "ol/source";
import { jaiaAPI, MapsDirectory, Tileset } from "../../../utils/jaia-api";

export class OfflineLayerManager {
    layerGroup = new LayerGroup({
        properties: {
            title: "Offline Layers",
            fold: "close",
        },
        layers: [],
    });

    maps_directory: MapsDirectory = null;

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
        return jaiaAPI.getHubMaps().then((maps_directory) => {
            const existing_offline_layers_by_name: { [key: string]: TileLayer<XYZ> } =
                Object.fromEntries(
                    this.layerGroup.getLayersArray().map((layer) => [layer.get("title"), layer]),
                );

            const layers =
                maps_directory?.maps?.map((map) => {
                    if (map.name in existing_offline_layers_by_name) {
                        return existing_offline_layers_by_name[map.name];
                    } else {
                        return new TileLayer({
                            properties: {
                                title: map.name,
                            },
                            zIndex: 20,
                            visible: false,
                            source: new XYZ({
                                url: `/maps/${map.name}/{z}/{x}/{y}`,
                            }),
                        });
                    }
                }) ?? [];

            this.layerGroup.setLayers(new Collection(layers));
            this.maps_directory = maps_directory;
            this.notify();
        });
    }
}

export const offlineLayerManager = new OfflineLayerManager();

import LayerGroup from "ol/layer/Group";
import TileLayer from "ol/layer/Tile";
import { Collection } from "ol";
import { XYZ } from "ol/source";
import { jaiaAPI, Tileset } from "../../../utils/jaia-api";

function tilesetArraysAreEqual(a: Tileset[], b: Tileset[]) {
    if (a.length != b.length) return false;

    const b_set = new Set(b.map((item) => JSON.stringify(item)));
    return [...a].every((value) => b_set.has(JSON.stringify(value)));
}

export class OfflineLayerManager {
    layerGroup = new LayerGroup({
        properties: {
            title: "Offline Layers",
            fold: "close",
        },
        layers: [],
    });

    tilesets: Tileset[] = [];

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
        return jaiaAPI.getHubMaps().then((tilesets) => {
            if (tilesetArraysAreEqual(this.tilesets, tilesets)) return;

            const layers = tilesets.map((tileset) => {
                return new TileLayer({
                    properties: {
                        title: tileset.name,
                    },
                    opacity: 0.7,
                    zIndex: 20,
                    source: new XYZ({
                        url: `/maps/${tileset.name}/{z}/{x}/{y}`,
                    }),
                });
            });

            this.layerGroup.setLayers(new Collection(layers));
            this.tilesets = tilesets;
            this.notify();
        });
    }
}

export const offlineLayerManager = new OfflineLayerManager();

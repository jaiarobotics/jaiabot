import TileLayer from "ol/layer/Tile";
import { View } from "ol";
import { TileImage } from "ol/source";

import { jaiaAPI } from "../../../utils/jaia-api";
import { offlineLayerManager } from "./offline-layer-manager";

interface TileDescriptior {
    layerName: string;
    zoom: number;
    x: number;
    y: number;
    url: string;
}

const MAX_ZOOM = 19;
const CONCURRENT_TILES_COUNT = 4;

class OfflineMapDownloader {
    private tileDescriptors: TileDescriptior[];
    private isRunning: boolean;
    private completedTiles: number;
    private observers: { [key: string]: (offlineMapDownloader: OfflineMapDownloader) => void };

    constructor() {
        this.tileDescriptors = [];
        this.isRunning = false;
        this.completedTiles = 0;
        this.observers = {};
    }

    getTileDescriptors() {
        return this.tileDescriptors;
    }

    getIsRunning() {
        return this.isRunning;
    }

    getCompletedTiles() {
        return this.completedTiles;
    }

    subscribe(hook: (offlineMapDownloader: OfflineMapDownloader) => void, hookLabel: string) {
        this.observers[hookLabel] = hook;
    }

    unsubscribe(hookLabel: string) {
        delete this.observers[hookLabel];
    }

    notify() {
        Object.keys(this.observers).forEach((hookLabel) => {
            this.observers[hookLabel](this);
        });
    }

    clear() {
        this.tileDescriptors = [];
    }

    async add(view: View, layer: TileLayer<TileImage>) {
        for (const tile of tileGenerator(view, layer)) {
            this.tileDescriptors.push(tile);
        }
        this.startDownloading();
    }

    getTileCount(view: View, layer: TileLayer<TileImage>) {
        let tileCount = 0;
        for (const tile of tileGenerator(view, layer)) {
            tileCount += 1;
        }
        return tileCount;
    }

    private async startDownloading() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.completedTiles = 0;

        while (true) {
            const tiles = this.tileDescriptors.splice(0, CONCURRENT_TILES_COUNT);
            if (tiles.length == 0) break;

            this.notify();

            const tileJobs = tiles.map((tile) => this.donwloadTile(tile));

            await Promise.allSettled(tileJobs)
                .then((results) => {
                    this.completedTiles += results.length;
                })
                .catch((error) => console.error(error));
        }
        this.isRunning = false;
        this.notify();
    }

    private async donwloadTile(tile: TileDescriptior) {
        const existingTile = await fetch(
            `/maps/${tile.layerName}/${tile.zoom}/${tile.x}/${tile.y}`,
            { method: "HEAD" },
        );
        if (!existingTile) {
            const tileBlob = await fetch(tile.url).then((response) => response.blob());
            jaiaAPI.putOfflineTile(tile.layerName, tile.zoom, tile.x, tile.y, tileBlob).then(() => {
                const mapsDirectory = offlineLayerManager.getMapsDirectory();
                const tileSetNames = mapsDirectory?.maps?.map((tileSet) => tileSet.name) ?? [];
                if (!(tile.layerName in tileSetNames)) {
                    offlineLayerManager.refresh();
                }
            });
        }
        // Number of tiles
        return 1;
    }
}

export const offlineMapDownloader = new OfflineMapDownloader();

/**
 * A generator function that creates TileDescriptors containing
 * URLs to download each tile up to the max zoom level
 *
 * @param {View} view Contains the extent and projection for identifying tile area
 * @param {TileLayer<TileImage>} layer Contains the source for getting tile data
 * @returns {Generator<TileDescriptor>} A generator of TileDescriptors which can be used to download the tiles
 */
function* tileGenerator(view: View, layer: TileLayer<TileImage>) {
    const extent = view.calculateExtent();
    const projection = view.getProjection();
    const source = layer.getSource();
    const tileGrid = source.getTileGridForProjection(view.getProjection());

    for (let z = 0; z <= MAX_ZOOM; z++) {
        const corner1 = tileGrid.getTileCoordForCoordAndZ([extent[0], extent[1]], z);
        const corner2 = tileGrid.getTileCoordForCoordAndZ([extent[2], extent[3]], z);

        const xRange = [corner1[1], corner2[1]].sort();
        const yRange = [corner1[2], corner2[2]].sort();

        for (let x = xRange[0]; x <= xRange[1]; x++) {
            for (let y = yRange[0]; y <= yRange[1]; y++) {
                const tileCoordAdjusted = source.getTileCoordForTileUrlFunction(
                    [z, x, y],
                    projection,
                );
                const url = source.tileUrlFunction(
                    tileCoordAdjusted,
                    window.devicePixelRatio,
                    projection,
                );
                yield {
                    layerName: layer.get("title"),
                    zoom: z,
                    x: x,
                    y: y,
                    url: url,
                };
            }
        }
    }
}

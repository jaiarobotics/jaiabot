import TileLayer from "ol/layer/Tile";
import { XYZ, TileImage } from "ol/source";
import { Collection, View } from "ol";
import { map, mapSettings, saveSettings } from "../../maps/map";
import { view } from "../../views/view";
import { jaiaAPI } from "../../../utils/jaia-api";

interface TileDescriptior {
    layerTitle: string;
    zoom: number;
    x: number;
    y: number;
    url: string;
}

const MAX_ZOOM = 19;
const CONCURRENT_TILES_COUNT = 4;

class OfflineLayerManager {
    private tileDescriptors: TileDescriptior[];
    private isRunning: boolean;
    private completedTiles: number;
    private layers: Collection<TileLayer<TileImage>>;
    private availableDiskBytes: number;

    constructor() {
        this.tileDescriptors = [];
        this.isRunning = false;
        this.completedTiles = 0;
        this.layers = new Collection<TileLayer<TileImage>>();
        this.availableDiskBytes = 0;
        this.createOfflineLayers();
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

    getLayers() {
        return this.layers;
    }

    getLayer(title: string) {
        for (const layer of this.layers.getArray()) {
            if (layer.get("title") === title) {
                return layer;
            }
        }
    }

    getAvailableDiskBytes() {
        return this.availableDiskBytes;
    }

    setAvailableDiskBytes(bytes: number) {
        this.availableDiskBytes = bytes;
    }

    /**
     * Stops the download of map tiles
     *
     * @returns {void}
     */
    clear() {
        this.tileDescriptors = [];
    }

    /**
     * Collects the layer's tiles from the viewport and begins the download
     *
     * @param {TileLayer<TileImage>} layer Which layer to save to Hub
     * @returns {void}
     */
    async add(layer: TileLayer<TileImage>) {
        for (const tile of tileGenerator(view, layer)) {
            this.tileDescriptors.push(tile);
        }
        this.startDownloading();
    }

    /**
     * Removes a saved layer from the Hub
     *
     * @param {string} layerTitle Which layer to remove from Hub
     * @returns {void}
     */
    async delete(layerTitle: string) {
        await jaiaAPI.deleteOfflineMap(layerTitle);
        const layersArray = this.layers.getArray();
        for (let i = 0; i < layersArray.length; i++) {
            if (layersArray[i].get("title") === layerTitle) {
                map.removeLayer(layersArray[i]);
                this.layers.removeAt(i);
            }
        }
    }

    /**
     * Calculates the number of tiles to be downloaded in the viewport
     *
     * @param {string} layerTitle Layer of interest
     * @returns {void}
     */
    getTileCount(layer: TileLayer<TileImage>) {
        let tileCount = 0;
        for (const tile of tileGenerator(view, layer)) {
            tileCount += 1;
        }
        return tileCount;
    }

    /**
     * Distributes the tile downloading work
     *
     * @returns {void}
     */
    private async startDownloading() {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;
        this.completedTiles = 0;

        while (true) {
            const tiles = this.tileDescriptors.splice(0, CONCURRENT_TILES_COUNT);
            if (tiles.length == 0) break;

            const tileJobs = tiles.map((tile) => this.donwloadTile(tile));

            const res = await Promise.allSettled(tileJobs)
                .then((results) => {
                    this.completedTiles += results.length;
                })
                .catch((error) => console.error(error));
        }
        this.createOfflineLayers();
        this.isRunning = false;
    }

    /**
     * Stores the tile on the Hub's tile server
     *
     * @param {TileDescriptior} tile Contains data for tile storage
     * @returns {number} Number of tiles downloaded
     */
    private async donwloadTile(tile: TileDescriptior) {
        const existingTile = await fetch(
            `/maps/${tile.layerTitle}/${tile.zoom}/${tile.x}/${tile.y}`,
            { method: "HEAD" },
        );
        if (!existingTile.ok) {
            const tileBlob = await fetch(tile.url).then((response) => response.blob());
            jaiaAPI.putOfflineTile(tile.layerTitle, tile.zoom, tile.x, tile.y, tileBlob);
        }
        // Number of tiles
        return 1;
    }

    /**
     * Takes the tile data from the server and converts it into a layer for use in the JCC
     *
     * @returns {void}
     */
    async createOfflineLayers() {
        const res = await jaiaAPI.getOfflineMaps();
        if (res.available_disk_bytes) {
            this.setAvailableDiskBytes(res.available_disk_bytes);
        }
        if (res.maps) {
            for (const tileSet of res.maps) {
                if (this.getLayer(tileSet.name)) {
                    continue;
                }
                const layer = new TileLayer({
                    properties: {
                        title: tileSet.name,
                        size: tileSet.size,
                    },
                    visible: mapSettings.visibleOfflineLayers?.includes(tileSet.name) ?? false,
                    source: new XYZ({
                        url: `/maps/${tileSet.name}/{z}/{x}/{y}`,
                    }),
                });
                layer.on("change:visible", () => {
                    mapSettings.visibleOfflineLayers = this.layers
                        .getArray()
                        .filter((l) => l.getVisible())
                        .map((l) => l.get("title"));
                    saveSettings();
                });
                this.layers.push(layer);
                map.addLayer(layer);
            }
        }
    }
}

export const offlineLayerManager = new OfflineLayerManager();

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
                    layerTitle: layer.get("title"),
                    zoom: z,
                    x: x,
                    y: y,
                    url: url,
                };
            }
        }
    }
}

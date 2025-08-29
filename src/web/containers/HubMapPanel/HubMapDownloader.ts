import TileLayer from "ol/layer/Tile";
import { TileImage } from "ol/source";
import View from "ol/View";
import { jaiaAPI } from "../../utils/jaia-api";
import { offlineLayerManager } from "../../openlayers/map/layers/offline-layers";

/**
 * Describes a layer with a view area and max zoom level for extraction.
 *
 * @interface LayerViewDescriptor
 * @typedef {LayerViewDescriptor}
 */
export interface LayerViewDescriptor {
    view: View;
    layer: TileLayer<TileImage>;
    max_zoom: number;
}

/**
 * Descriptor for a tile to download.
 *
 * @interface TileDescriptor
 * @typedef {TileDescriptor}
 */
interface TileDescriptor {
    layer_name: string;
    zoom: number;
    x: number;
    y: number;
    url: string;
}

/**
 * A generator function that generates TileDescriptors from a LayerViewDescriptor.  You can iterate through the TileDescriptors to get
 * URLs to download each tile up to the max zoom level.
 *
 * @param {LayerViewDescriptor} layerViewDescriptor An object indicating which view, layer, and max_zoom level to iterate through the tiles for.
 * @returns {Generator<TileDescriptor>} A generator of TileDescriptors, which can be used to download the tiles.
 */
function* tile_generator(layerViewDescriptor: LayerViewDescriptor): Generator<TileDescriptor> {
    const extent = layerViewDescriptor.view.calculateExtent();
    const projection = layerViewDescriptor.view.getProjection();
    const max_zoom = 19;

    const source = layerViewDescriptor.layer.getSource();

    // Get the tile coordinates
    const tile_grid = source.getTileGridForProjection(projection);

    for (let z = 0; z <= max_zoom; z++) {
        const corner1 = tile_grid.getTileCoordForCoordAndZ([extent[0], extent[1]], z);
        const corner2 = tile_grid.getTileCoordForCoordAndZ([extent[2], extent[3]], z);

        const x_range = [corner1[1], corner2[1]].sort();
        const y_range = [corner1[2], corner2[2]].sort();

        for (let x = x_range[0]; x <= x_range[1]; x++) {
            for (let y = y_range[0]; y <= y_range[1]; y++) {
                const tile_coord_adjusted = source.getTileCoordForTileUrlFunction(
                    [z, x, y],
                    projection,
                );
                const url = source.tileUrlFunction(
                    tile_coord_adjusted,
                    window.devicePixelRatio,
                    projection,
                );

                yield {
                    layer_name: layerViewDescriptor.layer.get("title"),
                    zoom: z,
                    x: x,
                    y: y,
                    url: url,
                };
            }
        }
    }
}

export class HubMapDownloader {
    tileDescriptors: TileDescriptor[] = [];
    running = false;
    completedTiles = 0;
    observer: (hubMapDownloader: HubMapDownloader, error?: string) => void = null;

    clear() {
        this.tileDescriptors = [];
    }

    /**
     * Add a layer and view to the download queue.
     *
     * @param {LayerViewDescriptor} layerViewDescriptor
     * @returns {*}
     */
    async add(layerViewDescriptor: LayerViewDescriptor) {
        for (const tile of tile_generator(layerViewDescriptor)) {
            this.tileDescriptors.push(tile);
        }
        this._startDownloading();
    }

    async _startDownloading() {
        if (this.running) {
            return;
        }

        this.running = true;
        this.completedTiles = 0;

        while (true) {
            const tile = this.tileDescriptors.shift();
            if (!tile) break;

            this.observer?.(this);

            // Do we already have this tile?
            const existingTile = await fetch(
                `/maps/${tile.layer_name}/${tile.zoom}/${tile.x}/${tile.y}`,
                { method: "HEAD" },
            );

            if (existingTile.ok) {
                console.log(
                    `Already have /maps/${tile.layer_name}/${tile.zoom}/${tile.x}/${tile.y}`,
                );
            } else {
                console.log(`Need to fetch ${tile.url}`);
                const tileBlob = await fetch(tile.url).then((response) => {
                    return response.blob();
                });
                jaiaAPI
                    .putOfflineTile(tile.layer_name, tile.zoom, tile.x, tile.y, tileBlob)
                    .then(() => {
                        // If this layer isn't in the list of offline layer titles, add it and refresh.
                        if (
                            !(
                                tile.layer_name in
                                offlineLayerManager.tilesets.map((tileset) => tileset.name)
                            )
                        ) {
                            offlineLayerManager.refresh();
                        }
                    });
            }

            this.completedTiles += 1;
        }

        this.running = false;
        this.observer?.(this);
    }
}

export const hubMapDownloader = new HubMapDownloader();

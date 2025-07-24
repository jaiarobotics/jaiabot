import { Map } from "ol";
import TileLayer from "ol/layer/Tile";
import { TileImage } from "ol/source";
import View from "ol/View";
import { jaiaAPI } from "../../utils/jaia-api";

interface OfflineTile {
    layer_name: string;
    zoom: number;
    x: number;
    y: number;
    url: string;
}

function* tile_generator(view: View, layers: TileLayer<TileImage>[]): Generator<OfflineTile> {
    const extent = view.calculateExtent();
    const projection = view.getProjection();
    const max_zoom = 19;

    for (const layer of layers) {
        const source = layer.getSource();

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
                        layer_name: layer.get("title"),
                        zoom: z,
                        x: x,
                        y: y,
                        url: url,
                    };
                }
            }
        }
    }
}

export class HubMapDownloadJob {
    map: Map;
    layers: TileLayer<TileImage>[];
    tile_count: number = 0;
    completed_tile_count: number = 0;
    running = false;

    constructor(map: Map, layers: TileLayer<TileImage>[]) {
        this.map = map;
        this.layers = layers;
    }

    cancel() {
        this.running = false;
    }

    async start(statusUpdateFunction: () => void) {
        this.tile_count = 0;
        for (const tile of tile_generator(this.map.getView(), this.layers)) {
            this.tile_count += 1;
        }

        this.completed_tile_count = 0;
        this.running = true;

        for (const tile of tile_generator(this.map.getView(), this.layers)) {
            if (!this.running) {
                break;
            }

            console.log(tile);

            try {
                await fetch(tile.url)
                    .then((response) => {
                        return response.blob();
                    })
                    .then((blob) => {
                        jaiaAPI.putOfflineTile(tile.layer_name, tile.zoom, tile.x, tile.y, blob);
                    });
            } catch (error) {
                console.error(error);
                this.running = false;
                return;
            }

            this.completed_tile_count += 1;
            statusUpdateFunction();
        }

        this.running = false;
        statusUpdateFunction();
    }
}

// IndexedDB
import { openDB } from "idb";
import { ImageTile } from "ol";
import TileSource from "ol/source/Tile";
import { Map } from "ol";
import { TileArcGISRest } from "ol/source";

const idbStore = {
    db1: openDB("db1", 1, {
        upgrade(db) {
            db.createObjectStore("store1");
        },
    }),
};

async function addToStore1(key: IDBKeyRange | IDBValidKey, value: any) {
    return (await idbStore.db1).add("store1", value, key);
}

async function getFromStore1(key: IDBKeyRange | IDBValidKey) {
    return (await idbStore.db1).get("store1", key);
}

async function addUrl(url: string) {
    return fetch(url).then((response) => {
        if (response.ok) {
            response.blob().then((blob) => {
                addToStore1(url, blob)
                    .then((p) => {
                        // console.log('added urlkey1 to store');
                        // console.log(p);
                    })
                    .catch(() => {
                        // console.log('urlkey1 already exists');
                    });
            });
        }
    });
}

async function addUrlIfNew(url: string) {
    return getFromStore1(url)
        .then((blob) => {
            if (!blob) {
                return addUrl(url);
            }
        })
        .catch((error) => {
            return addUrl(url);
        });
}

export function loadTileFromDatabase(tile: ImageTile, url: string) {
    const image = tile.getImage() as HTMLImageElement;

    getFromStore1(url)
        .then((blob) => {
            if (!blob) {
                // use online url
                image.src = url;

                // Let's add the tile to the cache since we missed it
                console.debug(`Cache miss: ${tile.tileCoord}`);
                addUrl(url);
                return;
            }
            const objUrl = URL.createObjectURL(blob);
            image.onload = function () {
                URL.revokeObjectURL(objUrl);
            };
            image.src = objUrl;
        })
        .catch((error) => {
            image.src = url;

            // Let's add the tile to the cache since we missed it
            console.debug(`Cache miss: ${tile.tileCoord}`);
            addUrl(url);
        });
}

export async function downloadOfflineTiles(map: Map, source: TileArcGISRest) {
    const view = map.getView();
    const extent = view.calculateExtent();
    const projection = view.getProjection();
    const resolution = view.getResolution();
    const max_zoom = 19;

    // Get the tile coordinates
    const tile_grid = source.getTileGridForProjection(projection);
    let tile_coords = [];

    for (let z = 0; z <= max_zoom; z++) {
        const corner1 = tile_grid.getTileCoordForCoordAndZ([extent[0], extent[1]], z);
        const corner2 = tile_grid.getTileCoordForCoordAndZ([extent[2], extent[3]], z);

        const x_range = [corner1[1], corner2[1]].sort();
        const y_range = [corner1[2], corner2[2]].sort();

        for (let x = x_range[0]; x <= x_range[1]; x++) {
            for (let y = y_range[0]; y <= y_range[1]; y++) {
                tile_coords.push([z, x, y]);
            }
        }
    }

    console.debug(`Total tiles to download: ${tile_coords.length}`);

    for (const tile_coord of tile_coords) {
        const tile_coord_adjusted = source.getTileCoordForTileUrlFunction(tile_coord, projection);
        const url = source.tileUrlFunction(
            tile_coord_adjusted,
            window.devicePixelRatio,
            projection,
        );

        await addUrlIfNew(url);
    }

    console.debug(`Total tiles downloaded: ${tile_coords.length}`);
}

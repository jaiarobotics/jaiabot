// IndexedDB
import { openDB } from "idb";
import { ImageTile } from "ol";
import { Map } from "ol";
import { TileImage } from "ol/source";

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

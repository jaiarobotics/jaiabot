import LayerGroup from 'ol/layer/Group'
import TileLayer from 'ol/layer/Tile'
import TileWMS from 'ol/source/TileWMS'
import { persistVisibility } from './VisibleLayerPersistance'
import { TileArcGISRest } from 'ol/source'
import { ImageTile } from 'ol'
import ImageLayer from 'ol/layer/Image.js';
import Static from 'ol/source/ImageStatic.js';
const aus00167P1 = require('../overlays/AUS00167P1.png') as string

// IndexedDB
import { openDB } from 'idb';

export const idbStore = {
	db1: openDB("db1", 1,  {
		upgrade(db) {
			db.createObjectStore('store1');
		},
	})
}

export async function addToStore1(key: IDBKeyRange | IDBValidKey, value: any) {
  return (await idbStore.db1).add("store1", value, key);
}

export async function getFromStore1(key: IDBKeyRange | IDBValidKey) {
  return (await idbStore.db1).get("store1", key);
}

const noaaEncSource = new TileArcGISRest({ url: 'https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/ENCOnline/MapServer/exts/MaritimeChartService/MapServer' })

noaaEncSource.setTileLoadFunction(function(tile: ImageTile, url) {
    const image = tile.getImage() as HTMLImageElement

    getFromStore1(url).then(blob => {
        if (!blob) {
            // use online url
            image.src = url;

            // Let's add the tile to the cache since we missed it
            fetch(url).then(response => {
                if (response.ok) {
                    response.blob().then(blob => {
                        addToStore1(url, blob).then(p => {
                            // console.log('added urlkey1 to store');
                            // console.log(p);
                        }).catch(() => {
                            // console.log('urlkey1 already exists');
                        });
                    });
                }
            });
            return;
        }

        const objUrl = URL.createObjectURL(blob);
        image.onload = function() {
            URL.revokeObjectURL(objUrl);
        };
        image.src = objUrl;
    }).catch(() => {
        image.src = url;

        // Let's add the tile to the cache since we missed it
        fetch(url).then(response => {
            if (response.ok) {
                response.blob().then(blob => {
                    addToStore1(url, blob).then(p => {
                        // console.log('added urlkey1 to store');
                        // console.log(p);
                    }).catch(() => {
                        // console.log('urlkey1 already exists');
                    });
                });
            }
        });
    });
})

export const gebcoLayer = new TileLayer({
    properties: {
        title: 'GEBCO Bathymetry',
    },
    zIndex: 10,
    opacity: 0.7,
    source: new TileWMS({
        url: 'https://www.gebco.net/data_and_products/gebco_web_services/web_map_service/mapserv?',
        params: {'LAYERS': 'GEBCO_LATEST_2_sub_ice_topo', 'VERSION':'1.3.0','FORMAT': 'image/png'},
        serverType: 'mapserver',
        projection: 'EPSG:4326', 
        wrapX: false
    }),
});

export function createChartLayerGroup() {
    
    // TODO make this an option for user
    const image_overlay = new ImageLayer({
        properties: {
            title: 'AUS00167P1',
        },
        source: new Static({
            attributions: '© <a href="https://xkcd.com/license.html">xkcd</a>',
            url: aus00167P1,
            projection: 'EPSG:4326',
            imageExtent: [146.814691, -41.161841, 146.892519, -41.128482],
        }),
        zIndex: 20,
    })


    // Configure the basemap layers
    let layers = [
        new TileLayer({
            properties: {
                title: 'NOAA ENC Charts',
            },
            opacity: 0.7,
            zIndex: 20,
            source: noaaEncSource,
        }),
        gebcoLayer,
        image_overlay
    ]
    
    layers.forEach((layer) => {
        persistVisibility(layer);
    });

    return new LayerGroup({
        properties: {
            title: 'Bathymetry',
            fold: 'close'
        },
        layers: layers
    })
}

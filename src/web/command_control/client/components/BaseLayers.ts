import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import { XYZ, OSM } from 'ol/source';
import { persistVisibility } from './VisibleLayerPersistance';

export function createBaseLayerGroup() {

    const layers = [
        new TileLayer({
            properties: {
                title: 'Google Satellite & Roads',
                type: 'base',
            },
            zIndex: 1,
            source: new XYZ({ url: 'http://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', wrapX: false }),
        }),
        new TileLayer({
            properties: {
                title: 'OpenStreetMap',
                type: 'base',
            },
            zIndex: 1,
            source: new OSM({ wrapX: false }),
        })
    ]

    layers.forEach(layer => persistVisibility(layer))

    return new LayerGroup({
        properties: {
            title: 'Base Maps',
            fold: 'close',
        },
        layers: layers
    })

}

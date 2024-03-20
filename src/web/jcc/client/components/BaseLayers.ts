import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import { XYZ, OSM } from 'ol/source';
import { persistVisibility } from './VisibleLayerPersistance';
import * as Layers from './shared/Layers'

export function createBaseLayerGroup() {

    const layers = [
        Layers.getArcGISSatelliteImageryLayer(),
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

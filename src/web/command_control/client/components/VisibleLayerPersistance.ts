import { GlobalSettings, Save } from './Settings'
import { Layer } from 'ol/layer'

let mapSettings = GlobalSettings.mapSettings

export function persistVisibility(layer: Layer) {
    let title = layer.get('title')

    // Set visible if it should be
    let visible = mapSettings.visibleLayers.has(title)
    layer.set('visible', visible)

    // Catch change in visible state
    layer.on('change:visible', () => {
        if (layer.getVisible()) {
            mapSettings.visibleLayers.add(title)
        } else {
            mapSettings.visibleLayers.delete(title)
        }
        Save(mapSettings)
    })
}

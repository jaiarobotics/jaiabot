import { Settings } from "./Settings"
import { Layer } from "ol/layer"

let visibleLayers = new Set(Settings.mapVisibleLayers.get() || ['OpenStreetMap', 'NOAA ENC Charts'])

export function persistVisibility(layer: Layer) {
	let title = layer.get("title")

	// Set visible if it should be
	let visible = visibleLayers.has(title)
	layer.set("visible", visible)

	// Catch change in visible state
	layer.on("change:visible", () => {
		if (layer.getVisible()) {
			visibleLayers.add(title)
		}
		else {
			visibleLayers.delete(title)
		}
		Settings.mapVisibleLayers.set(visibleLayers)
	})
}

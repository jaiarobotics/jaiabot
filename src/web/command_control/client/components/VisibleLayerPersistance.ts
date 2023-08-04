import { GlobalSettings, Save } from "./Settings"
import { Layer } from "ol/layer"

let mapSettings = GlobalSettings.mapSettings

export function persistVisibility(layer: Layer) {
	let title = layer.get("title")

	// Set visible if it should be
	let visible = mapSettings.visibleLayers.some((otherTitle) => { return otherTitle === title })
	layer.set("visible", visible)

	// Catch change in visible state
	layer.on("change:visible", () => {
		if (layer.getVisible()) {
			if (!(title in mapSettings.visibleLayers)) {
				mapSettings.visibleLayers.push(title)
			}
		}
		else {
			// Delete title from visibleLayers
			mapSettings.visibleLayers = mapSettings.visibleLayers.filter((otherTitle) => { return otherTitle !== title })
		}
		Save(mapSettings)
	})
}

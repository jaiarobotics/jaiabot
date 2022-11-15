import * as Template from "./Template"
import * as Popup from "./Popup"
import { fromLonLat } from "ol/proj"
import { Feature } from "ol"
import { Point } from "ol/geom"


// Creates an OpenLayers marker feature with a popup using options
// parameters: {title?, lon, lat, style?, time?, popupHTML?}
export function createMarker(map, parameters) {
    const lonLat = [parameters.lon, parameters.lat]
    const coordinate = fromLonLat(lonLat, map.getView().getProjection())

    const markerFeature = new Feature({
        name: parameters.title ?? 'Marker',
        geometry: new Point(coordinate)
    })

    if (parameters.style != null) {
        markerFeature.setStyle(parameters.style)
    }

    // Convert time to a string
    if (parameters.time != null) {
        parameters.time = dateStringFromMicros(parameters.time)
    }

    // If we received a popupHTML, then use it
    if (parameters.popupHTML != null) {
        var popupElement = document.createElement('div')
        popupElement.classList = "popup"
        popupElement.innerHTML = parameters.popupHTML
        Popup.addPopup(map, markerFeature, popupElement)
    }

    return markerFeature
}

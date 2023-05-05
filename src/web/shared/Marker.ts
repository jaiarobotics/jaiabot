import * as Popup from "./Popup"
import { fromLonLat } from "ol/proj"
import { Feature, Map } from "ol"
import { Point } from "ol/geom"
import Style from "ol/style/Style"


// Get date description from microsecond timestamp
function dateStringFromMicros(timestamp_micros: number): string {
    return new Date(timestamp_micros / 1e3).toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
    })
}


interface MarkerParameters {
    lon: number
    lat: number
    popupHTML?: string
    title?: string
    style?: Style
}


// Creates an OpenLayers marker feature with a popup using options
// parameters: {title?, lon, lat, style?, time?, popupHTML?}
export function createMarker(map: Map, parameters: MarkerParameters) {
    const lonLat = [parameters.lon, parameters.lat]
    const coordinate = fromLonLat(lonLat, map.getView().getProjection())

    const markerFeature = new Feature({
        name: parameters.title ?? 'Marker',
        geometry: new Point(coordinate)
    })

    if (parameters.style != null) {
        markerFeature.setStyle(parameters.style)
    }

    // If we received a popupHTML, then use it
    if (parameters.popupHTML != null) {
        var popupElement = document.createElement('div')
        popupElement.classList.add("popup")
        popupElement.innerHTML = parameters.popupHTML
        Popup.addPopup(map, markerFeature, popupElement)
    }

    return markerFeature
}

export function createFlagMarker(map: Map, parameters: MarkerParameters) {
    // Using adjusted coordinate so flag maintains its position directly on top of the waypoint regardless of zoom level
    const lonLat = [parameters.lon, parameters.lat]
    const coordinate = fromLonLat(lonLat, map.getView().getProjection())
    const pixel = map.getPixelFromCoordinate(coordinate)
    // (+21, -32) positions the flag directly on top of the waypoint
    const adjustedPixel = [pixel[0] + 21, pixel[1] - 32]
    const adjustedCoordinate = map.getCoordinateFromPixel(adjustedPixel)

    const flagFeature = new Feature({
        name: 'Run Flag',
        geometry: new Point(adjustedCoordinate)
    })

    if (parameters.style != null) {
        flagFeature.setStyle(parameters.style)
    }

    return flagFeature
}

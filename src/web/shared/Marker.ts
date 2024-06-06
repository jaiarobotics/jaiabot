import Style from "ol/style/Style";
import * as Popup from "./Popup";
import { Feature, Map } from "ol";
import { fromLonLat } from "ol/proj";
import { Point } from "ol/geom";

// Get date description from microsecond timestamp
function dateStringFromMicros(timestamp_micros: number): string {
    return new Date(timestamp_micros / 1e3).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZoneName: "short",
    });
}

interface MarkerParameters {
    lon: number;
    lat: number;
    popupHTML?: string;
    title?: string;
    style?: Style;
}

export function createMarker(map: Map, parameters: MarkerParameters) {
    const lonLat = [parameters.lon, parameters.lat];
    const coordinate = fromLonLat(lonLat, map.getView().getProjection());

    const markerFeature = new Feature({
        name: parameters.title ?? "Marker",
        geometry: new Point(coordinate),
    });

    if (parameters.style != null) {
        markerFeature.setStyle(parameters.style);
    }

    // If we received a popupHTML, then use it
    if (parameters.popupHTML != null) {
        var popupElement = document.createElement("div");
        popupElement.classList.add("popup");
        popupElement.innerHTML = parameters.popupHTML;
        Popup.addPopup(map, markerFeature, popupElement);
    }

    return markerFeature;
}

export function createFlagMarker(map: Map, parameters: MarkerParameters) {
    const lonLat = [parameters.lon, parameters.lat];
    const coordinate = fromLonLat(lonLat, map.getView().getProjection());

    const flagFeature = new Feature({
        name: "Run Flag",
        geometry: new Point(coordinate),
    });

    if (parameters.style != null) {
        flagFeature.setStyle(parameters.style);
    }

    return flagFeature;
}

export function createGPSMarker(map: Map, parameters: MarkerParameters) {
    const lonLat = [parameters.lon, parameters.lat];
    const coordinate = fromLonLat(lonLat, map.getView().getProjection());

    const gpsFeature = new Feature({
        name: "GPS Icon",
        geometry: new Point(coordinate),
    });

    if (parameters.style != null) {
        gpsFeature.setStyle(parameters.style);
    }

    return gpsFeature;
}

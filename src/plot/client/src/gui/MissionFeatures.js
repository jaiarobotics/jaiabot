import { Feature, Map } from "ol"
import { LineString, Point } from "ol/geom"
import { fromLonLat } from "ol/proj"
import * as Styles from "./Styles"
import * as Template from "./Template"
import * as Popup from "./Popup"


// Get date description from microsecond timestamp
function dateStringFromMicros(timestamp_micros) {
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


// Creates an OpenLayers marker feature with a popup using options
// parameters: {title?, lon, lat, style?, time?, popupHTML?}
function createMarker(map, parameters) {
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
    var popupElement
    if (parameters.popupHTML != null) {
        popupElement = document.createElement('div')
        popupElement.classList = "popup"
        popupElement.innerHTML = parameters.popupHTML
    }
    else {
        popupElement = Template.get('markerPopup', parameters)
    }

    Popup.addPopup(map, markerFeature, popupElement)

    return markerFeature
}


export function createMissionFeatures(map, command, activeGoalIndex) {
    var features = []
    const projection = map.getView().getProjection()

    // Add markers for each waypoint
    var missionLineStringCoordinates = []

    for (const [goal_index, goal] of command.plan.goal.entries()) {
        const location = goal.location

        if (location == null) {
            continue
        }

        {
            // OpenLayers
            const markerFeature = createMarker(map, {title: 'Goal ' + goal_index, lon: location.lon, lat: location.lat, style: Styles.goal(goal_index, goal, goal_index == activeGoalIndex)})
            features.push(markerFeature)
        }

        missionLineStringCoordinates.push(fromLonLat([location.lon, location.lat], projection))
    }

    // Add a linestring for the mission path
    const missionPathFeature = new Feature({geometry: new LineString(missionLineStringCoordinates)})
    missionPathFeature.setStyle(Styles.missionPath)
    features.push(missionPathFeature)

    return features
}

import { Feature, Map } from "ol"
import { LineString, Point } from "ol/geom"
import { fromLonLat } from "ol/proj"
import * as Styles from "./Styles"
import { createMarker } from './Marker'


export function createMissionFeatures(map, command, activeGoalIndex, isSelected) {
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
            const markerFeature = createMarker(map, {title: 'Goal ' + goal_index, lon: location.lon, lat: location.lat, style: Styles.goal(goal_index, goal, goal_index == activeGoalIndex, isSelected)})
            markerFeature.goal = goal
            features.push(markerFeature)
        }

        missionLineStringCoordinates.push(fromLonLat([location.lon, location.lat], projection))
    }

    // Add a linestring for the mission path
    const missionPathFeature = new Feature({geometry: new LineString(missionLineStringCoordinates)})
    missionPathFeature.set("isSelected", isSelected)
    missionPathFeature.setStyle(Styles.missionPath)
    features.push(missionPathFeature)

    return features
}

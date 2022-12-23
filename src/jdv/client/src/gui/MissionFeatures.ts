import { Feature, Map } from "ol"
import { Coordinate } from "ol/coordinate"
import { LineString, Geometry } from "ol/geom"
import { fromLonLat } from "ol/proj"
import * as Styles from "./Styles"
import { createMarker } from './Marker'
import { Plan } from './ProtoBufMessages'

export function createMissionFeatures(map: Map, plan: Plan, activeGoalIndex: number, isSelected: boolean) {
    var features: Feature<Geometry>[] = []
    const projection = map.getView().getProjection()

    // Add markers for each waypoint
    var missionLineStringCoordinates: Coordinate[] = []

    for (const [goal_index, goal] of plan.goal.entries()) {
        const location = goal.location

        if (location == null) {
            continue
        }

        {
            // OpenLayers
            const markerFeature = createMarker(map, {title: 'Goal ' + goal_index, lon: location.lon, lat: location.lat, style: Styles.goal(goal_index, goal, goal_index == activeGoalIndex, isSelected)})
            markerFeature.set("goal", goal)
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

import * as Styles from "./Styles"
import { Feature, Map } from "ol"
import { Coordinate } from "ol/coordinate"
import { Geometry, LineString } from "ol/geom"
import { fromLonLat } from "ol/proj"
import { createMarker, createFlagMarker } from './Marker'
import { MissionPlan, TaskType, GeographicCoordinate } from './JAIAProtobuf';
import { getGeographicCoordinate } from "./Utilities"
import { transformTranslate, point } from "@turf/turf"
import BaseEvent from "ol/events/Event"
import Point from 'ol/geom/Point';

export function createMissionFeatures(
    map: Map,
    botId: number,
    plan: MissionPlan,
    activeGoalIndex: number,
    isSelected: boolean,
    canEdit: boolean,
    existingMissionFeatures: Feature<Geometry>[],
    dragProcessor: (updatedMissionFeatures: Feature<Geometry>[]) => void,
    runNumber?: string,
    zIndex?: number
) {
    const features = []
    const projection = map.getView().getProjection()

    function geograpicCoordinateToCoordinate(geographicCoordinate: GeographicCoordinate) {
        return fromLonLat([geographicCoordinate.lon, geographicCoordinate.lat], projection)
    }

    let goals = plan.goal ?? []

    for (const [goalIndex, goal] of goals.entries()) {
        const location = goal.location
        // Increment by one to account for 0 index
        const goalIndexStartAtOne = goalIndex + 1;

        if (location == null) { continue }

        // OpenLayers
        const activeRun = plan.hasOwnProperty('speeds')
        const markerFeature = createMarker(
            map, 
            {
                title: 'Goal ' + goalIndexStartAtOne, 
                lon: location.lon, 
                lat: location.lat,
                style: Styles.goal(goalIndexStartAtOne, goal, activeRun ? goalIndexStartAtOne == activeGoalIndex : false, isSelected, canEdit)
            }
        )

        markerFeature.setProperties({
            goal: goal, 
            botId: botId, 
            goalIndex: goalIndexStartAtOne,
            location: location,
            canEdit: canEdit,
            id: `wpt-${goalIndexStartAtOne}`,
            type: 'wpt',
            isSelected: isSelected
        })

        markerFeature.getGeometry().on('change', (evt: BaseEvent) => handleWaypointPositionChange(evt, markerFeature, map, plan, existingMissionFeatures, dragProcessor))

        features.push(markerFeature)

        if (goalIndexStartAtOne === 1) {
            if (!runNumber) {
                runNumber = ''
            }
            const flagFeature = createFlagMarker(
                map, 
                {
                    lon: location.lon, 
                    lat: location.lat,
                    style: Styles.flag(goal, isSelected, runNumber, zIndex, canEdit)
                }
            )
            flagFeature.setProperties({
                type: 'flag',
                runNumber: runNumber,
                isSelected: isSelected
            })            
            features.push(flagFeature)
        }

        // For Constant Heading tasks, we add another point to the line string at the termination point
        let task = goal.task
        var startCoordinate: Coordinate

        if (task?.type == TaskType.CONSTANT_HEADING) {
            // Calculate targetPoint
            let constantHeadingStartPoint = point([location.lon, location.lat])
            let distance = task.constant_heading.constant_heading_speed * task.constant_heading.constant_heading_time
            let heading = task.constant_heading.constant_heading
            let constantHeadingEndPoint = transformTranslate(constantHeadingStartPoint, distance, heading, {units: 'meters'})
            let constantHeadingEndCoordinate = fromLonLat(constantHeadingEndPoint.geometry.coordinates, projection)
            let coordinatesArray = [fromLonLat(constantHeadingStartPoint.geometry.coordinates, projection), constantHeadingEndCoordinate]

            // Create and add the constant heading arrow feature (dotted line)
            let constantHeadingSegment = new Feature({ geometry: new LineString(coordinatesArray) })
            constantHeadingSegment.set("isSelected", isSelected)
            constantHeadingSegment.set("isConstantHeading", true)
            constantHeadingSegment.setStyle(Styles.missionPath)
            features.push(constantHeadingSegment)

            // This mission leg line segment (solid lline) will start at the constant heading end coordinate
            startCoordinate = constantHeadingEndCoordinate
        }
        else {
            // This mission leg line segment will start at this goal's location
            startCoordinate = geograpicCoordinateToCoordinate(location)
        }

        // Add a linestring for this leg of the mission path, if there is a next goal
        if (goals.length > goalIndex + 1) {
            const nextGoal = goals[goalIndex + 1]
            const nextLocation = nextGoal.location

            if (nextLocation == null) {
                continue
            }

            let missionLineStringCoordinates = [
                startCoordinate,
                geograpicCoordinateToCoordinate(nextLocation)
            ]

            const missionPathFeature = new Feature({geometry: new LineString(missionLineStringCoordinates)})
            missionPathFeature.setProperties({
                isSelected: isSelected,
                canEdit: canEdit,
                startPointGoalNum: goalIndex + 1,
                endPointGoalNum: goalIndex + 2,
                startCoordinate: startCoordinate,
                endCoordinate: geograpicCoordinateToCoordinate(nextLocation),
                id: `line-${goalIndex + 1}`,
                type: 'line'
            })
            missionPathFeature.setStyle(Styles.missionPath)
            features.push(missionPathFeature)
        }
    }
    return features
}

function handleWaypointPositionChange(
    evt: BaseEvent,
    markerFeature: Feature<Point>,
    map: Map,
    plan: MissionPlan,
    existingMissionFeatures: Feature<Geometry>[],
    dragProcessor: (updatedMissionFeatures: Feature<Geometry>[]) => void
) {
    if (!markerFeature.get('canEdit') || !markerFeature.get('isSelected')) {
        return
    }
    const geometry = evt.target
    const newCoordinatesRaw = geometry.flatCoordinates
    const newCoordinatesAdjusted = getGeographicCoordinate(newCoordinatesRaw, map)
    const goalNumber = markerFeature.get('goalIndex')
    const waypointId = markerFeature.get('id')
    // Update the location saved in the goals array so when updateMissionLayer() is called in CommandControl it does not reset the changes
    plan.goal[goalNumber - 1].location = newCoordinatesAdjusted
    const updatedMissionFeatures = updateDragFeaturePosition(map, plan, existingMissionFeatures, waypointId, newCoordinatesAdjusted)
    // Triggers a layer update in CommandControl for the features impacted by dragging a waypoint
    dragProcessor(updatedMissionFeatures)
}

function updateDragFeaturePosition(
    map: Map,
    plan: MissionPlan,
    missionFeatures: Feature<Geometry>[],
    waypointId: string,
    newCoordinates: GeographicCoordinate
) {
    const missionFeaturesUpdated: Feature<Geometry>[] = []
    const numOfWaypoints = plan.goal.length

    for (let feature of missionFeatures) {
        const featureId = feature.get('id')
        const waypointNum = Number(waypointId.slice(4))
        const lonLat = [newCoordinates.lon, newCoordinates.lat]
        const coordinate = fromLonLat(lonLat, map.getView().getProjection())

        // Make no changes
        if (!feature.get('isSelected')) {}
        // The iterated feature is the waypoint
        else if (featureId === waypointId) {
            feature.setGeometry(new Point(coordinate))
        } 
        // Move the flag if the first waypoint is being moved 
        else if (waypointNum === 1 && feature.get('type') === 'flag') {
            feature.setGeometry(new Point(coordinate))
        } 
        // If the first waypoint is being moved, adjust the start point of the line and hold the end point constant
        else if (waypointNum === 1 && feature.get('id') === 'line-1') {
            const startCoordinate = coordinate
            const endCoordinate = feature.get('endCoordinate')
            feature.setGeometry(new LineString([startCoordinate, endCoordinate]))
            feature.set('startCoordinate', coordinate)
        } 
        // If the last waypoint is being moved, adjust the end point of the line and hold the start point constant
        else if (waypointNum === numOfWaypoints && feature.get('id') === `line-${numOfWaypoints - 1}`) {
            const startCoordinate = feature.get('startCoordinate')
            const endCoordinate = coordinate
            feature.setGeometry(new LineString([startCoordinate, endCoordinate]))
            feature.set('endCoordinate', coordinate)
        } 
        // Perform the necessary line movements for dragging 'middle' waypoints
        else if (waypointNum > 1 && waypointNum < numOfWaypoints) {
            // Adjust the line that comes before the waypoint
            if (feature.get('id') === `line-${Number(waypointId.slice(4)) - 1}`) {
                const startCoordinate = feature.get('startCoordinate')
                const endCoordinate = coordinate
                feature.setGeometry(new LineString([startCoordinate, endCoordinate]))
                feature.set('endCoordinate', coordinate)
            } 
            // Adjust the line that comes after the waypoint
            else if (feature.get('id') === `line-${Number(waypointId.slice(4))}`) {
                const startCoordinate = coordinate
                const endCoordinate = feature.get('endCoordinate')
                feature.setGeometry(new LineString([startCoordinate, endCoordinate]))
                feature.set('startCoordinate', coordinate)
            }
        }
        missionFeaturesUpdated.push(feature)
    }
    return missionFeaturesUpdated
}

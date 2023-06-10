import { Feature, Map } from 'ol'
import { Coordinate } from 'ol/coordinate'
import { Style } from 'ol/style'
import { LineString, Geometry } from 'ol/geom'
import { fromLonLat } from 'ol/proj'
import * as Styles from './Styles'
import { createMarker, createFlagMarker } from './Marker'
import { MissionPlan, TaskType, GeographicCoordinate } from './JAIAProtobuf'
import { transformTranslate, point } from '@turf/turf'

export function createMissionFeatures(
    map: Map,
    botId: number,
    plan: MissionPlan,
    activeGoalIndex: number,
    isSelected: boolean,
    runNumber?: string,
    zIndex?: number
) {
    const features = []
    const projection = map.getView().getProjection()

    function GeograpicCoordinateToCoordinate(geographicCoordinate: GeographicCoordinate) {
        return fromLonLat([geographicCoordinate.lon, geographicCoordinate.lat], projection)
    }

    // Add markers for each waypoint
    const missionLineStringCoordinates: Coordinate[] = []

    const goals = plan.goal ?? []

    for (const [goal_index, goal] of goals.entries()) {
        const location = goal.location

        // Increment by one to account for 0 index
        const goal_index_start_at_one = goal_index + 1

        if (location == null) {
            continue
        }

        {
            // OpenLayers
            const activeRun = Object.prototype.hasOwnProperty.call(plan, 'speeds') ? true : false
            const markerFeature = createMarker(map, {
                title: 'Goal ' + goal_index_start_at_one,
                lon: location.lon,
                lat: location.lat,
                style: Styles.goal(
                    goal_index_start_at_one,
                    goal,
                    activeRun ? goal_index_start_at_one == activeGoalIndex : false,
                    isSelected
                )
            })
            markerFeature.setProperties({
                goal: goal,
                botId: botId,
                goalIndex: goal_index_start_at_one
            })
            features.push(markerFeature)

            if (goal_index_start_at_one === 1) {
                if (!runNumber) {
                    runNumber = ''
                }
                const flagFeature = createFlagMarker(map, {
                    lon: location.lon,
                    lat: location.lat,
                    style: Styles.flag(goal, isSelected, runNumber, zIndex)
                })
                features.push(flagFeature)
            }
        }

        // For Constant Heading tasks, we add another point to the line string at the termination point
        const task = goal.task
        let startCoordinate: Coordinate

        if (task?.type == TaskType.CONSTANT_HEADING) {
            // Calculate targetPoint
            const constantHeadingStartPoint = point([location.lon, location.lat])
            const distance =
                task.constant_heading.constant_heading_speed *
                task.constant_heading.constant_heading_time
            const heading = task.constant_heading.constant_heading
            const constantHeadingEndPoint = transformTranslate(
                constantHeadingStartPoint,
                distance,
                heading,
                { units: 'meters' }
            )
            const constantHeadingEndCoordinate = fromLonLat(
                constantHeadingEndPoint.geometry.coordinates,
                projection
            )
            const coordinatesArray = [
                fromLonLat(constantHeadingStartPoint.geometry.coordinates, projection),
                constantHeadingEndCoordinate
            ]

            // Create and add the constant heading arrow feature (dotted line)
            const constantHeadingSegment = new Feature({ geometry: new LineString(coordinatesArray) })
            constantHeadingSegment.set('isSelected', isSelected)
            constantHeadingSegment.set('isConstantHeading', true)
            constantHeadingSegment.setStyle(Styles.missionPath)
            features.push(constantHeadingSegment)

            // This mission leg line segment (solid lline) will start at the constant heading end coordinate
            startCoordinate = constantHeadingEndCoordinate
        } else {
            // This mission leg line segment will start at this goal's location
            startCoordinate = GeograpicCoordinateToCoordinate(location)
        }

        // Add a linestring for this leg of the mission path, if there is a next goal
        if (goals.length > goal_index + 1) {
            const next_goal = goals[goal_index + 1]
            const next_location = next_goal.location

            if (next_location == null) {
                continue
            }

            const missionLineStringCoordinates = [
                startCoordinate,
                GeograpicCoordinateToCoordinate(next_location)
            ]

            const missionPathFeature = new Feature({
                geometry: new LineString(missionLineStringCoordinates)
            })
            missionPathFeature.set('isSelected', isSelected)
            missionPathFeature.setStyle(Styles.missionPath)
            features.push(missionPathFeature)
        }
    }

    return features
}

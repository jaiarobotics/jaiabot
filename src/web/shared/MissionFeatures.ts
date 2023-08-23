import * as Styles from "./Styles"
import { Feature, Map } from "ol"
import { Coordinate } from "ol/coordinate"
import { LineString } from "ol/geom"
import { fromLonLat } from "ol/proj"
import { createMarker, createFlagMarker } from './Marker'
import { MissionPlan, TaskType, GeographicCoordinate } from './JAIAProtobuf';
import { transformTranslate, point } from "@turf/turf"
import { PortalBotStatus } from "./PortalStatus"

export function createMissionFeatures(
    map: Map,
    bot: PortalBotStatus,
    plan: MissionPlan,
    activeGoalIndex: number,
    isSelected: boolean,
    canEdit: boolean,
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
                style: Styles.getGoalStyle(goalIndexStartAtOne, goal, activeRun ? goalIndexStartAtOne == activeGoalIndex : false, isSelected, canEdit)
            }
        )

        markerFeature.setProperties({
            goal: goal, 
            botId: bot?.bot_id, 
            goalIndex: goalIndexStartAtOne,
            location: location,
            canEdit: canEdit,
            id: `wpt-${goalIndexStartAtOne}`,
            type: 'wpt',
            isSelected: isSelected
        })

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
                    style: Styles.getFlagStyle(goal, isSelected, runNumber, zIndex, canEdit)
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

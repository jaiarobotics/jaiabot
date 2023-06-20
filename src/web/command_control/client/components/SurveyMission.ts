import { Goal } from "./shared/JAIAProtobuf";
import { Feature as OlFeature } from "ol";
import { Geometry } from "ol/geom";
import { MultiPoint as OlMultiPoint } from "ol/geom";
import { Style as OlStyle } from "ol/style";
import * as Styles from "./shared/Styles"
import { GeographicCoordinate } from "./shared/JAIAProtobuf";
import { MissionParams } from "./MissionSettings";
import { MissionTask } from "./shared/JAIAProtobuf";
import { CommandList } from "./Missions";
import { deepcopy } from "./Utilities";
import * as turf from "@turf/turf"
import { TaskType } from "./shared/JAIAProtobuf";
import { Command } from "./shared/JAIAProtobuf";
import { MovementType } from "./shared/JAIAProtobuf";
import { CommandType } from "./shared/JAIAProtobuf";
import { MissionStart } from "./shared/JAIAProtobuf";


/**
 * Returns a set of features illustrating the missionPlanningGrid
 * 
 * @returns A list of features representing the mission planning waypoints (preview)
 */
export function featuresFromMissionPlanningGrid(missionPlanningGrid: {[key: string]: number[][]}, missionBaseGoal: Goal) {
    var features: OlFeature<Geometry>[] = []

    let mpg = missionPlanningGrid;
    let mpgKeys = Object.keys(mpg);

    mpgKeys.forEach(key => {
        const bot_id = Number(key)

        let mpGridFeature = new OlFeature(
            {
                geometry: new OlMultiPoint(mpg[key]),
                style: new OlStyle({
                    image: Styles.goalIcon(missionBaseGoal.task.type, false, false)
                })
            }
        )
        mpGridFeature.setProperties({'botId': key});
        mpGridFeature.setStyle(new OlStyle({
            image: Styles.goalIcon(missionBaseGoal.task.type, false, false)
        }))

        features.push(mpGridFeature);
    })

    return features
}

/**
 * Gets a mission plan from the set of survey mission parameters
 * 
 * @param botIdList 
 * @param rallyStartLocation 
 * @param rallyEndLocation 
 * @param missionParams 
 * @param missionPlanningGrid 
 * @param missionEndTask 
 * @param missionBaseGoal 
 * @returns A CommandList (dictionary mapping botIds to Commands)
 */
export function getSurveyMissionPlans(botIdList: number[], rallyStartLocation: GeographicCoordinate, rallyEndLocation: GeographicCoordinate, 
    missionParams: MissionParams, missionPlanningGrid: {[key: string]: number[][]}, missionEndTask: MissionTask, missionBaseGoal: Goal) {
    
    let missionPlans: CommandList = {};
    let millisecondsSinceEpoch = new Date().getTime();

    /**
     * Assign rally point coordinates to each botId in a list
     * 
     * @param botIdList List of botIds
     * @param centerCoordinate Center coordinate of rally points 
     * @param rotationAngle Angle along which to space rally points for each bot
     * @param rallySpacing Spacing between rally points (meters)
     * @returns 
     */
    function findRallySeparation(botIdList: number[], centerCoordinate: GeographicCoordinate, rotationAngle: number, rallySpacing: number) {
        botIdList = deepcopy(botIdList)

        // Bot rally point separation scheme
        let rallyPoints: {[key: number]: number[]} = {};
        let center = [centerCoordinate.lon, centerCoordinate.lat];
        let radius = rallySpacing/1000;
        if (botIdList.length >= 3) {
            // We can use a circle to separate the bots
            let options = {steps: botIdList.length};
            let circle = turf.circle(center, radius, options);
            let circleRallyPointsBasic = turf.coordAll(turf.cleanCoords(turf.multiPoint(circle.geometry.coordinates[0])));
            circleRallyPointsBasic.forEach(p => {
                rallyPoints[Number(botIdList.pop())] = p
            })
        } else {
            // Alternative to using a circle for bot separation
            let rhumbDestinationPoints: number[][][] = [];
            let nextRadius = 0;
            botIdList.forEach(bot => {
                rhumbDestinationPoints.push(turf.coordAll(turf.rhumbDestination(turf.point(center), nextRadius, rotationAngle-90)));
                nextRadius = nextRadius + radius;
            })
            rhumbDestinationPoints.forEach(p => {
                rallyPoints[Number(botIdList.pop())] = p[0]
            })
        }
        return rallyPoints
    }

    // Bot rally point separation scheme
    let rallyStartPoints = findRallySeparation(botIdList, rallyStartLocation, missionParams.orientation, missionParams.rally_spacing);
    // console.log('rallyStartPoints');
    // console.log(rallyStartPoints);
    let rallyFinishPoints = findRallySeparation(botIdList, rallyEndLocation, missionParams.orientation, missionParams.rally_spacing);
    // console.log('rallyFinishPoints');
    // console.log(rallyFinishPoints);

    let mpg = missionPlanningGrid;
    let mpgKeys = Object.keys(mpg);
    mpgKeys.forEach(key => {
        const botId = Number(key)

        // TODO: Update the mission plan for the bots at the same time??
        // Create the goals from the missionPlanningGrid
        let bot_goals = [];

        // Rally Point Goals
        let bot_goal: Goal = {
            "location": {
                "lat": rallyStartPoints[botId][1],
                "lon": rallyStartPoints[botId][0]
            },
            "task": {"type": TaskType.NONE}
        }
        bot_goals.push(bot_goal)

        // Mission Goals
        const bot_mission_goal_positions: turf.helpers.Position[] = mpg[key]

        bot_mission_goal_positions.forEach((goal: turf.helpers.Position, index: number) => {
            let goalWgs84 = turf.coordAll(turf.toWgs84(turf.point(goal)))[0]

            // For each bot's final goal, we use the missionEndTask, (like a Constant Heading task)
            const is_last_goal = index == bot_mission_goal_positions.length - 1
            const task = is_last_goal ? missionEndTask : missionBaseGoal.task

            bot_goal = {
                "location": {
                    "lat": goalWgs84[1],
                    "lon": goalWgs84[0]
                },
                "task": task
            }
            bot_goals.push(bot_goal);
        })

        // Home Goals
        bot_goal = {
            "location": {
                "lat": rallyFinishPoints[botId][1],
                "lon": rallyFinishPoints[botId][0]
            },
            "task": {
                type: TaskType.NONE
            }
        }
        bot_goals.push(bot_goal)

        let mission_dict: Command = {
            bot_id: Number(key),
            time: millisecondsSinceEpoch,
            type: CommandType.MISSION_PLAN,
            plan: {
                start: MissionStart.START_IMMEDIATELY,
                movement: MovementType.TRANSIT,
                goal: bot_goals,
                recovery: {
                    recover_at_final_goal: true
                }
            }
        }
        missionPlans[botId] = mission_dict;
    })

    return missionPlans
}

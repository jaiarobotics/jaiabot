import { Goal } from "../../shared/JAIAProtobuf";
import { Feature as OlFeature } from "ol";
import { Geometry } from "ol/geom";
import { MultiPoint as OlMultiPoint } from "ol/geom";
import { Style as OlStyle } from "ol/style";
import * as Styles from "../../shared/Styles";
import { GeographicCoordinate } from "../../shared/JAIAProtobuf";
import { MissionParams } from "../../containers/MissionSettingsPanel/MissionSettingsPanel";
import { MissionTask } from "../../shared/JAIAProtobuf";
import { CommandList } from "../missions";
import { deepcopy } from "../../shared/Utilities";
import * as turf from "@turf/turf";
import { Position } from "geojson";
import { TaskType } from "../../shared/JAIAProtobuf";
import { Command } from "../../shared/JAIAProtobuf";
import { MovementType } from "../../shared/JAIAProtobuf";
import { CommandType } from "../../shared/JAIAProtobuf";
import { MissionStart } from "../../shared/JAIAProtobuf";
import { Fill as OlFillStyle } from "ol/style";
import { Stroke as OlStrokeStyle } from "ol/style";
import { Icon as OlIcon } from "ol/style";
import { Point as OlPoint } from "ol/geom";
import { Text as OlText } from "ol/style";
import { LineString } from "ol/geom";

const missionOrientationIcon = require("../../style/icons/compass.svg");

/**
 * Returns a set of features illustrating the missionPlanningGrid
 *
 * @returns A list of features representing the mission planning waypoints (preview)
 */
export function featuresFromMissionPlanningGrid(
    missionPlanningGrid: { [key: string]: number[][] },
    missionBaseGoal: Goal,
) {
    var features: OlFeature<Geometry>[] = [];

    let mpg = missionPlanningGrid;
    let mpgKeys = Object.keys(mpg);

    mpgKeys.forEach((key) => {
        let mpGridFeature = new OlFeature({
            geometry: new OlMultiPoint(mpg[key]),
            style: new OlStyle({
                image: Styles.createGoalIcon(
                    missionBaseGoal.task?.type,
                    false,
                    false,
                    false,
                    missionBaseGoal.task?.start_echo,
                ),
            }),
        });
        mpGridFeature.setProperties({ botId: key });
        mpGridFeature.setStyle(
            new OlStyle({
                image: Styles.createGoalIcon(
                    missionBaseGoal.task?.type,
                    false,
                    false,
                    false,
                    missionBaseGoal.task?.start_echo,
                ),
            }),
        );

        features.push(mpGridFeature);
    });

    return features;
}

/**
 * Gets a mission plan from the set of survey mission parameters
 *
 * @param rallyStartLocation
 * @param rallyEndLocation
 * @param missionPlanningGrid
 * @param missionEndTask
 * @param missionBaseGoal
 * @returns A CommandList (dictionary mapping botIds to Commands)
 */
export function getSurveyMissionPlans(
    rallyStartLocation: GeographicCoordinate,
    rallyEndLocation: GeographicCoordinate,
    missionPlanningGrid: { [key: string]: number[][] },
    missionBaseGoal: Goal,
    missionStartTask: MissionTask,
    missionEndTask: MissionTask,
    numBots: number,
) {
    let missionPlans: CommandList = {};
    let millisecondsSinceEpoch = new Date().getTime();

    let mpg = missionPlanningGrid;
    let laneKeys = Object.keys(mpg);
    let runIndex = 0;
    let remainder = laneKeys.length % numBots; // Remainder of extra lanes that we haven't accounted for if our run number and fleet size don't divide evenly

    // Loop through all mission runs, grouping them by lanesPerRun,
    // so each bot is assigned one run that may include multiple adjacent lanes
    // (e.g., if lanesPerRun = 2, bot 1 gets runs 1 & 2, bot 2 gets runs 3 & 4, etc.)
    let i = 0;
    while (i < laneKeys.length) {
        // Calculate the number of lanes per run for this run group
        let lanesPerRun = Math.floor(laneKeys.length / numBots);

        // If there is still a remainder that we haven't accounted for, add one to lanesPerRun
        if (remainder > 0) {
            lanesPerRun = lanesPerRun + 1;
            remainder = remainder - 1;
        }

        let botGoals: Goal[] = [];

        // Rally Start
        botGoals.push({
            location: {
                lat: rallyStartLocation?.lat,
                lon: rallyStartLocation?.lon,
            },
            task: missionStartTask,
        });

        // For each lane in this run group, convert its positions to WGS84 and
        // push them directly to botGoals, assigning missionEndTask to the last point in each lane
        for (let j = 0; j < lanesPerRun && i + j < laneKeys.length; j++) {
            const key = laneKeys[i + j];
            const positions = mpg[key];

            // Convert and add tasks
            positions.forEach((goal: Position, index: number) => {
                const isLastInLane = index === positions.length - 1;
                const task = isLastInLane ? missionEndTask : missionBaseGoal.task;

                const goalWgs84 = turf.coordAll(turf.toWgs84(turf.point(goal)))[0];

                botGoals.push({
                    location: {
                        lat: goalWgs84[1],
                        lon: goalWgs84[0],
                    },
                    task,
                });
            });
        }

        // Rally End
        botGoals.push({
            location: {
                lat: rallyEndLocation?.lat,
                lon: rallyEndLocation?.lon,
            },
            task: {
                type: TaskType.NONE,
            },
        });

        missionPlans[runIndex] = {
            bot_id: -1,
            time: millisecondsSinceEpoch,
            type: CommandType.MISSION_PLAN,
            plan: {
                start: MissionStart.START_IMMEDIATELY,
                movement: MovementType.TRANSIT,
                goal: botGoals,
                recovery: {
                    recover_at_final_goal: true,
                },
            },
        };
        runIndex++;
        i += lanesPerRun;
    }

    return missionPlans;
}

export function surveyStyle(feature: OlFeature<Geometry>, taskType: TaskType) {
    let iStyle = Styles.createGoalIcon(taskType, false, false, false, false);

    let lineStyle = new OlStyle({
        fill: new OlFillStyle({
            color: "rgba(255, 255, 255, 0.2)",
        }),
        stroke: new OlStrokeStyle({
            color: "rgb(5,29,97)",
            lineDash: [10, 10],
            width: 2,
        }),
        image: iStyle,
    });

    let iconStyle = new OlStyle({
        image: new OlIcon({
            src: missionOrientationIcon,
            scale: [0.5, 0.5],
        }),
        text: new OlText({
            font: "15px Calibri,sans-serif",
            fill: new OlFillStyle({ color: "#000000" }),
            stroke: new OlStrokeStyle({
                color: "#ffffff",
                width: 0.1,
            }),
            placement: "point",
            textAlign: "start",
            justify: "left",
            textBaseline: "bottom",
            offsetY: -100,
            offsetX: 100,
        }),
    });
    let stringCoords = (feature.getGeometry() as LineString).getCoordinates();
    let coords = stringCoords.slice(0, 2);

    iconStyle.setGeometry(new OlPoint(stringCoords[0]));
    iconStyle
        .getImage()
        .setRotation(Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1]));

    return [lineStyle, iconStyle];
}

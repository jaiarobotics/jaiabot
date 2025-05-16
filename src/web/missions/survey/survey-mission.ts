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
        const bot_id = Number(key);

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
    missionLanesPerRun: number,
    missionApplyEndTaskPerLane: boolean,
) {
    let missionPlans: CommandList = {};
    let millisecondsSinceEpoch = new Date().getTime();

    let mpg = missionPlanningGrid;
    let mpgKeys = Object.keys(mpg);

    // How many lanes to group per bot
    let lanesPerBot = missionLanesPerRun;
    let applyEndTaskPerLane = missionApplyEndTaskPerLane;

    let groupIndex = 0;

    for (let i = 0; i < mpgKeys.length; i += lanesPerBot) {
        const botKey = mpgKeys[groupIndex]; // this gives "0", "1", "2", ...
        const botId = Number(botKey);

        let botGoals: Goal[] = [];

        // Rally Start
        botGoals.push({
            location: {
                lat: rallyStartLocation?.lat,
                lon: rallyStartLocation?.lon,
            },
            task: missionStartTask,
        });

        let combinedGoalPositions: { pos: Position; task: MissionTask }[] = [];

        for (let j = 0; j < lanesPerBot && i + j < mpgKeys.length; j++) {
            const key = mpgKeys[i + j];
            const positions = mpg[key];

            positions.forEach((goal: Position, index: number) => {
                const isLastInLane = index === positions.length - 1;
                const task =
                    applyEndTaskPerLane && isLastInLane ? missionEndTask : missionBaseGoal.task;

                combinedGoalPositions.push({ pos: goal, task });
            });
        }

        // Fallback: assign missionEndTask to last goal in combined list if the flag is false
        if (!applyEndTaskPerLane && combinedGoalPositions.length > 0) {
            combinedGoalPositions[combinedGoalPositions.length - 1].task = missionEndTask;
        }

        // Convert and add tasks
        combinedGoalPositions.forEach(({ pos, task }) => {
            const goalWgs84 = turf.coordAll(turf.toWgs84(turf.point(pos)))[0];

            botGoals.push({
                location: {
                    lat: goalWgs84[1],
                    lon: goalWgs84[0],
                },
                task,
            });
        });

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

        missionPlans[botId] = {
            bot_id: -1, // You can update this with the real bot ID if needed
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

        groupIndex++;
    }

    console.log(missionPlans);

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

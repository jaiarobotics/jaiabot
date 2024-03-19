import { Goal } from "./shared/JAIAProtobuf";
import { Feature as OlFeature } from "ol";
import { Geometry } from "ol/geom";
import { Style as OlStyle } from "ol/style";
import { GeographicCoordinate } from "./shared/JAIAProtobuf";
import { MissionTask } from "./shared/JAIAProtobuf";
import { CommandList } from "./Missions";
import { TaskType } from "./shared/JAIAProtobuf";
export declare function featuresFromMissionPlanningGrid(missionPlanningGrid: {
    [key: string]: number[][];
}, missionBaseGoal: Goal): OlFeature<Geometry>[];
export declare function getSurveyMissionPlans(rallyStartLocation: GeographicCoordinate, rallyEndLocation: GeographicCoordinate, missionPlanningGrid: {
    [key: string]: number[][];
}, missionBaseGoal: Goal, missionStartTask: MissionTask, missionEndTask: MissionTask): CommandList;
export declare function surveyStyle(feature: OlFeature<Geometry>, taskType: TaskType): OlStyle[];

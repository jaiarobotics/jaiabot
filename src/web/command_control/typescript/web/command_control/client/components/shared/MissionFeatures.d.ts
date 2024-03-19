import { Feature, Map } from "ol";
import { LineString, Point } from "ol/geom";
import { MissionPlan } from './JAIAProtobuf';
import { PortalBotStatus } from "./PortalStatus";
export declare function createMissionFeatures(map: Map, bot: PortalBotStatus, plan: MissionPlan, activeGoalIndex: number, isSelected: boolean, canEdit: boolean, runNumber?: string, zIndex?: number): (Feature<Point> | Feature<LineString>)[];

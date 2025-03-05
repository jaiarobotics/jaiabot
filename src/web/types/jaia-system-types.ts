import { MissionState } from "./protobuf-types";
import {
    DiveParameters,
    DriftParameters,
    ConstantHeadingParameters,
    StationKeepParameters,
} from "./protobuf-types";

export enum NodeTypes {
    NONE = "NONE",
    BOT = "BOT",
    HUB = "HUB",
}

export interface SelectedNode {
    type: NodeTypes;
    id: number;
}

export interface SelectedWaypoint {
    waypointNum: number;
    missionID: number;
}

export interface MissionStatus {
    missionState?: MissionState;
    activeGoal?: number;
    distanceToActiveGoal?: number;
    repeatIndex?: number;
}

export interface TaskParameters {
    dive: DiveParameters;
    drift: DriftParameters;
    stationKeep: StationKeepParameters;
    constantHeading: ConstantHeadingParameters;
}

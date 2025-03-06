import { MissionState } from "./protobuf-types";

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
    maxDepth: number;
    depthInterval: number;
    holdTime: number;
}

export enum TaskParameterKeys {
    MAX_DEPTH = "MAX_DEPTH",
    DEPTH_INTERVAL = "DEPTH_INTERVAL",
    HOLD_TIME = "HOLD_TIME",
}

export interface TaskParameterPair {
    key: TaskParameterKeys;
    value: number;
}

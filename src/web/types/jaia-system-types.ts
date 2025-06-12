import {
    ConstantHeadingParameters,
    DiveParameters,
    DriftParameters,
    MissionState,
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
    targetWaypoint?: number;
    distanceToTargetWaypoint?: number;
    repeatIndex?: number;
}

export interface TaskParameters {
    dive: DiveParameters;
    drift: DriftParameters;
    constantHeading: ConstantHeadingParameters;
}

export enum TaskParameterKeys {
    MAX_DEPTH = "MAX_DEPTH",
    DEPTH_INTERVAL = "DEPTH_INTERVAL",
    HOLD_TIME = "HOLD_TIME",
    DRIFT_TIME = "DRIFT_TIME",
    HEADING = "HEADING",
    CONSTANT_HEADING_TIME = "CONSTANT_HEADING_TIME",
    SPEED = "SPEED",
}

export interface TaskParameterPair {
    key: TaskParameterKeys;
    value: number;
}

export enum SystemButtonTypes {
    SHUTDOWN = 1,
    REBOOT = 2,
    RESTART_SERVICES = 3,
}

export enum ButtonListTypes {
    TOP = 1,
    SIDE = 2,
}

export enum CoordinateTypes {
    LAT = "LAT",
    LON = "LON",
}

export const enum BotModes {
    NONE = 1,
    MISSION = 2,
    REMOTE_CONTROL = 3,
}

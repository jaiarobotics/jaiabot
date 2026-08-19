import { MapFeatureTypes } from "./openlayers-types";
import {
    MissionState,
    MissionTask_ConstantHeadingParameters,
    MissionTask_DiveParameters,
    MissionTask_DriftParameters,
    MissionTask_StationKeepParameters,
} from "../shared/proto/jaiabot/messages/mission";

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
    isMoveable: boolean;
}

export interface SelectedTaskPacket {
    botID: number;
    startTime: number;
    type: MapFeatureTypes;
}

export interface MissionStatus {
    missionState?: MissionState;
    targetWaypoint?: number;
    distanceToTargetWaypoint?: number;
    repeatIndex?: number;
}

export interface TaskParameters {
    dive: MissionTask_DiveParameters;
    drift: MissionTask_DriftParameters;
    constantHeading: MissionTask_ConstantHeadingParameters;
    stationKeep: MissionTask_StationKeepParameters;
}

export enum TaskParameterKeys {
    MAX_DEPTH = "MAX_DEPTH",
    DEPTH_INTERVAL = "DEPTH_INTERVAL",
    HOLD_TIME = "HOLD_TIME",
    DRIFT_TIME = "DRIFT_TIME",
    HEADING = "HEADING",
    CONSTANT_HEADING_TIME = "CONSTANT_HEADING_TIME",
    SPEED = "SPEED",
    STATION_KEEP_TIME = "STATION_KEEP_TIME",
    SAFETY_DEPTH = "SAFETY_DEPTH",
}

export interface TaskParameterPair {
    key: TaskParameterKeys;
    value: number;
}

export interface GhostParameters {
    hasStarted: boolean;
    botID: number;
    repeats: number;
    isGhost?: boolean;
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
    MISSION = 1,
    REMOTE_CONTROL = 2,
}

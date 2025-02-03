import { MissionState } from "../utils/protobuf-types";

export interface MissionStatus {
    missionState?: MissionState;
    activeGoal?: number;
    distanceToActiveGoal?: number;
    repeatIndex?: number;
}

import Task from "../tasks/task";
import { GeographicCoordinate } from "../../types/protobuf-types";

class GridMission {
    private missionStart: GeographicCoordinate;
    private missionEnd: GeographicCoordinate;
    private gridStart: GeographicCoordinate;
    private gridEnd: GeographicCoordinate;
    private numOfLanes: number;
    private laneSpacing: number;
    private pointSpacing: number;
    private surveyTask: Task;
    private endTask: Task;
}

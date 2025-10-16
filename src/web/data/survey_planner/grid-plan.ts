import Task from "../tasks/task";
import { GeographicCoordinate } from "../../types/protobuf-types";

export enum GridPlanningStates {
    ACCEPTING_MISSION_START_LOCATION = 1,
    ACCEPTING_MISSION_END_LOCATION = 2,
    ACCEPTING_GRID_DRAWING = 3,
    ACCEPTING_TASK = 4,
    APPROVED = 5,
}

export interface GridPlanDetails {
    missionStart: GeographicCoordinate;
    missionEnd: GeographicCoordinate;
    gridStart: GeographicCoordinate;
    gridEnd: GeographicCoordinate;
    numOfLanes: number;
    laneSpacing: number;
    pointSpacing: number;
    surveyTask: Task;
    endTask: Task;
    state: GridPlanningStates;
}

export class GridPlan {
    private missionStart: GeographicCoordinate;
    private missionEnd: GeographicCoordinate;
    private gridStart: GeographicCoordinate;
    private gridEnd: GeographicCoordinate;
    private numOfLanes: number;
    private laneSpacing: number;
    private pointSpacing: number;
    private surveyTask: Task;
    private endTask: Task;
    private state: GridPlanningStates;

    constructor() {
        this.state = GridPlanningStates.ACCEPTING_MISSION_START_LOCATION;
    }

    getGridPlanDetails() {
        const gridPlanDetails: GridPlanDetails = {
            missionStart: this.missionStart,
            missionEnd: this.missionEnd,
            gridStart: this.gridStart,
            gridEnd: this.gridEnd,
            numOfLanes: this.numOfLanes,
            laneSpacing: this.laneSpacing,
            pointSpacing: this.pointSpacing,
            surveyTask: this.surveyTask,
            endTask: this.endTask,
            state: this.state,
        };
        return gridPlanDetails;
    }

    getState() {
        return this.state;
    }

    setState(state: GridPlanningStates) {
        this.state = state;
    }
}

export const gridPlan = new GridPlan();

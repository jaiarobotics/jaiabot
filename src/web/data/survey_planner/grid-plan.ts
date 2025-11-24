import Task from "../tasks/task";
import Mission from "../mission_set/mission";
import { INIT_LANES } from "../../utils/constants";
import { GeographicCoordinate } from "../../types/protobuf-types";
import cloneDeep from "lodash/cloneDeep";

export enum GridPlanningStates {
    ACCEPTING_MISSION_START_LOCATION = 1,
    ACCEPTING_MISSION_END_LOCATION = 2,
    ACCEPTING_GRID_DRAWING = 3,
    ACCEPTING_TASK = 4,
    ACCEPTING_START_TASK = 5,
    ACCEPTING_END_TASK = 6,
    APPROVED = 7,
}

export interface GridPlanDetails {
    numOfLanes: number;
    laneSpacing: number;
    pointSpacing: number;
    surveyTask: Task;
    state: GridPlanningStates;
}

export interface GridPanSnapshot {
    missionStart: GeographicCoordinate;
    missionEnd: GeographicCoordinate;
    numOfLanes: number;
    laneSpacing: number;
    pointSpacing: number;
    surveyTask: Task;
    startTask: Task;
    endTask: Task;
    state: GridPlanningStates;
    missions: Map<number, Mission>;
}

export class GridPlan {
    private missionStart: GeographicCoordinate;
    private missionEnd: GeographicCoordinate;
    private numOfLanes: number;
    private laneSpacing: number;
    private pointSpacing: number;
    private surveyTask: Task;
    private startTask: Task;
    private endTask: Task;
    private state: GridPlanningStates;
    private missions: Map<number, Mission>;

    constructor() {
        this.state = GridPlanningStates.ACCEPTING_MISSION_START_LOCATION;
        this.numOfLanes = INIT_LANES;
        this.laneSpacing = 10;
        this.pointSpacing = 10;
        this.surveyTask = new Task();
        this.startTask = new Task();
        this.endTask = new Task();
        this.missions = new Map<number, Mission>();
    }

    reset() {
        this.state = GridPlanningStates.ACCEPTING_MISSION_START_LOCATION;
        this.surveyTask = new Task();
        this.missions = new Map<number, Mission>();
    }

    getGridPlanDetails() {
        const gridPlanDetails: GridPlanDetails = {
            numOfLanes: this.numOfLanes,
            laneSpacing: this.laneSpacing,
            pointSpacing: this.pointSpacing,
            surveyTask: this.surveyTask,
            state: this.state,
        };
        return gridPlanDetails;
    }

    getMissionStart() {
        return this.missionStart;
    }

    setMissionStart(start: GeographicCoordinate) {
        this.missionStart = start;
    }

    getMissionEnd() {
        return this.missionEnd;
    }

    setMissionEnd(end: GeographicCoordinate) {
        this.missionEnd = end;
    }

    getNumOfLanes() {
        return this.numOfLanes;
    }

    setNumOfLanes(numOfLanes: number) {
        this.numOfLanes = numOfLanes;
    }

    getLaneSpacing() {
        return this.laneSpacing;
    }

    setLaneSpacing(laneSpacing: number) {
        this.laneSpacing = laneSpacing;
    }

    getPointSpacing() {
        return this.pointSpacing;
    }

    setPointSpacing(pointSpacing: number) {
        this.pointSpacing = pointSpacing;
    }

    getSurveyTask() {
        return this.surveyTask;
    }

    setSurveyTask(surveyTask: Task) {
        this.surveyTask = surveyTask;
    }

    getStartTask() {
        return this.startTask;
    }

    setStartTask(startTask: Task) {
        this.startTask = startTask;
    }

    getEndTask() {
        return this.endTask;
    }

    setEndTask(endTask: Task) {
        this.endTask = endTask;
    }

    getState() {
        return this.state;
    }

    setState(state: GridPlanningStates) {
        this.state = state;
    }

    getMissions() {
        return this.missions;
    }

    setMissions(missions: Map<number, Mission>) {
        this.missions = missions;
    }

    /**
     * Captures a snapshot of the current Grid Plan
     *
     * @returns {GridPanSnapshot} snapshot of current Grid Plan
     */
    captureSnapshot() {
        const currentGridPlan = {
            missionStart: this.missionStart,
            missionEnd: this.missionEnd,
            numOfLanes: this.numOfLanes,
            laneSpacing: this.laneSpacing,
            pointSpacing: this.pointSpacing,
            surveyTask: this.surveyTask,
            startTask: this.startTask,
            endTask: this.endTask,
            state: this.state,
            missions: this.missions,
        } as GridPanSnapshot;
        return cloneDeep(currentGridPlan);
    }

    /**
     * Replaces the current missionsManager set with one from a saved snapshot
     *
     * @param {GridPanSnapshot} snapshot Snapshot of missionsManager
     * @returns {void}
     *
     */

    restoreFromSnapshot(snapshot: GridPanSnapshot) {
        this.missions.clear();
        for (const [k, v] of snapshot.missions) {
            this.missions.set(k, v);
        }
        this.missionStart = snapshot.missionStart;
        this.missionEnd = snapshot.missionEnd;
        this.numOfLanes = snapshot.numOfLanes;
        this.laneSpacing = snapshot.laneSpacing;
        this.pointSpacing = snapshot.pointSpacing;
        this.surveyTask = snapshot.surveyTask;
        this.startTask = snapshot.startTask;
        this.endTask = snapshot.endTask;
        this.state = snapshot.state;
    }
}

export const gridPlan = new GridPlan();

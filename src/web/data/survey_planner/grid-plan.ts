import Task from "../tasks/task";
import Mission from "../mission_set/mission";
import { missionSet } from "../mission_set/mission-set";
import { GeographicCoordinate } from "../../types/protobuf-types";

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
    numOfBots: number;
    laneSpacing: number;
    pointSpacing: number;
    surveyTask: Task;
    state: GridPlanningStates;
}

export class GridPlan {
    private missionStart: GeographicCoordinate;
    private missionEnd: GeographicCoordinate;
    private numOfLanes: number;
    private numOfBots: number;
    private laneSpacing: number;
    private pointSpacing: number;
    private surveyTask: Task;
    private startTask: Task;
    private endTask: Task;
    private state: GridPlanningStates;
    private missions: Map<number, Mission>;

    constructor() {
        this.state = GridPlanningStates.ACCEPTING_MISSION_START_LOCATION;
        this.numOfLanes = 5;
        this.laneSpacing = 10;
        this.pointSpacing = 10;
        this.numOfBots = 1;
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
            numOfBots: this.numOfBots,
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

    getNumOfBots() {
        return this.numOfBots;
    }

    setNumOfBots(numOfBots: number) {
        this.numOfBots = numOfBots;
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

    fitLanesToBots() {
        const lanesPerBot = Math.floor(this.numOfLanes / this.numOfBots);
        let extraLanes = this.numOfLanes % this.numOfBots;

        if (lanesPerBot === 1 && extraLanes === 0) {
            return;
        }

        let lanesCovered = 0;
        while (lanesCovered < this.numOfLanes) {
            let updatedLanesPerBot = lanesPerBot;
            if (extraLanes > 0) {
                updatedLanesPerBot += 1;
                extraLanes -= 1;
            }

            const baseMission = missionSet.getMission(lanesCovered + 1);

            for (let i = lanesCovered; i < lanesCovered + updatedLanesPerBot; i++) {
                const mission = missionSet.getMission(i + 1);
                // Remove mission end location if not last lane in group
                if (i + 1 < updatedLanesPerBot) {
                    mission.getWaypoints().pop();
                }
                // Remove mission start location if not first lane in group
                if (i !== lanesCovered) {
                    mission.getWaypoints().shift();
                    baseMission.addWaypoints([...mission.getWaypoints()]);
                }
                missionSet.deleteMission(mission.getMissionID());
            }

            lanesCovered += updatedLanesPerBot;
        }
    }
}

export const gridPlan = new GridPlan();

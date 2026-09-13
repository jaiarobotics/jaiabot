import cloneDeep from "lodash/cloneDeep";
import Task from "../tasks/task";
import Mission from "../mission_set/mission";
import { UNASSIGNED_ID, MAX_WAYPOINTS } from "../../utils/constants";
import { BottomDepthSafetyParams, GeographicCoordinate, Segment } from "../../types/protobuf-types";

export enum GridPlanningStates {
    ACCEPTING_MISSION_START_LOCATION = 1,
    ACCEPTING_MISSION_END_LOCATION = 2,
    ACCEPTING_GRID_DRAWING = 3,
    ACCEPTING_TASK = 4,
    ACCEPTING_START_TASK = 5,
    ACCEPTING_END_TASK = 6,
    OFFERING_SRP = 7,
    ACCEPTING_SRP = 8,
    APPROVED = 9,
}

export interface GridPlanDetails {
    numOfLanes: number;
    numOfBots: number;
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

const ENDPOINTS = 2;

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
    private srpTask: Task;
    private state: GridPlanningStates;
    private missions: Map<number, Mission>;
    private maxWaypointsPerLane: number;

    constructor() {
        this.state = GridPlanningStates.ACCEPTING_MISSION_START_LOCATION;
        this.numOfLanes = UNASSIGNED_ID;
        this.numOfBots = UNASSIGNED_ID;
        this.laneSpacing = 10;
        this.pointSpacing = 10;
        this.surveyTask = new Task(true);
        this.startTask = new Task(true);
        this.endTask = new Task(true);
        this.srpTask = new Task(true);
        this.missions = new Map<number, Mission>();
        this.maxWaypointsPerLane = MAX_WAYPOINTS;
    }

    reset() {
        this.state = GridPlanningStates.ACCEPTING_MISSION_START_LOCATION;
        this.surveyTask = new Task(true);
        this.startTask = new Task(true);
        this.endTask = new Task(true);
        this.srpTask = new Task(true);
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

    getSRPTask() {
        return this.srpTask;
    }

    setSRPTask(srpTask: Task) {
        this.srpTask = srpTask;
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

    getMaxWaypointsPerLane() {
        return this.maxWaypointsPerLane;
    }

    /**
     * Sets the max waypoints per lane based on the number of lanes per Bot
     *
     * @returns {void}
     */
    calculateMaxPointsPerLane() {
        const lanesPerBot = Math.ceil(this.getNumOfLanes() / this.getNumOfBots());
        this.maxWaypointsPerLane = Math.floor(MAX_WAYPOINTS / lanesPerBot) - ENDPOINTS;
    }

    /**
     * When the number of lanes exceeds the number of Bots, the extra lanes
     * will be shared among the Bots. Bots can be assigned multiple adjacent lanes.
     * Each additional lane does not require the Bot to transit to the
     * mission start + end points.
     *
     * @returns {void}
     */
    fitLanesToBots() {
        const lanesPerBot = Math.floor(this.numOfLanes / this.numOfBots);
        let extraLanes = this.numOfLanes % this.numOfBots;
        let lanesCovered = 0;
        let missionID = 1;

        if (lanesPerBot === 1 && extraLanes === 0) {
            return;
        }

        while (lanesCovered < this.numOfLanes) {
            let updatedLanesPerBot = lanesPerBot;
            let nextLaneStartIndex = 1;

            if (extraLanes > 0) {
                updatedLanesPerBot += 1;
                extraLanes -= 1;
            }

            const baseMission = new Mission();
            const segment: Segment = {
                start_goal_index: 0,
                lane_start_goal_indices: [nextLaneStartIndex],
            };
            baseMission.setMissionID(missionID);

            for (let i = lanesCovered; i < lanesCovered + updatedLanesPerBot; i++) {
                const mission = this.missions.get(i + 1);
                // Do not count start + end points
                nextLaneStartIndex += mission.getWaypoints().length - 2;
                // Remove mission end location if not last lane in group
                if (i + 1 < lanesCovered + updatedLanesPerBot) {
                    mission.getWaypoints().pop();
                }

                // Remove mission start location if not first lane in group
                if (i !== lanesCovered) {
                    mission.getWaypoints().shift();
                }

                segment.lane_start_goal_indices.push(nextLaneStartIndex);
                baseMission.addWaypoints(cloneDeep(mission.getWaypoints()));
                baseMission.setSegments([segment]);
                this.missions.delete(mission.getMissionID());
            }
            this.missions.set(baseMission.getMissionID(), baseMission);
            lanesCovered += updatedLanesPerBot;
            missionID += 1;
        }
    }

    /**
     * Attaches the safety return parameters to each mission
     * in the grid plan mission set
     *
     * @returns {void}
     */
    applySafetyReturnParameters() {
        for (const mission of this.missions.values()) {
            const constantHeadingParams = this.srpTask.getConstantHeadingParameters();
            const bottomDepthSafetyParams: BottomDepthSafetyParams = {
                constant_heading: constantHeadingParams.constant_heading.toString(),
                constant_heading_speed: constantHeadingParams.constant_heading_speed.toString(),
                constant_heading_time: constantHeadingParams.constant_heading_time.toString(),
                safety_depth: gridPlan.getSRPTask().getSafetyDepth().toString(),
            };
            mission.setBottomDepthSafetyParams(bottomDepthSafetyParams);
        }
    }

    /**
     * Provides the task that is being modified in the survey planning
     * process based on state
     *
     * @returns {Task} Which task the user is modifying
     */
    getPlanningTask() {
        if (this.state === GridPlanningStates.ACCEPTING_TASK) {
            return this.surveyTask;
        }
        if (this.state === GridPlanningStates.ACCEPTING_START_TASK) {
            return this.startTask;
        }
        if (this.state === GridPlanningStates.ACCEPTING_END_TASK) {
            return this.endTask;
        }
        if (this.state === GridPlanningStates.ACCEPTING_SRP) {
            return this.srpTask;
        }
    }

    /**
     * Captures a snapshot of the current GridPlan
     *
     * @returns {GridPanSnapshot} Snapshot of current GridPlan
     */
    captureSnapshot() {
        const snapshot: GridPanSnapshot = {
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
        };
        return cloneDeep(snapshot);
    }

    /**
     * Replaces the current properties with those from the saved snapshot
     *
     * @param {GridPanSnapshot} snapshot Snapshot of GridPlan
     * @returns {void}
     */
    restoreFromSnapshot(snapshot: GridPanSnapshot) {
        const restored = cloneDeep(snapshot);
        this.missions = restored.missions;
        this.missionStart = restored.missionStart;
        this.missionEnd = restored.missionEnd;
        this.numOfLanes = restored.numOfLanes;
        this.laneSpacing = restored.laneSpacing;
        this.pointSpacing = restored.pointSpacing;
        this.surveyTask = restored.surveyTask;
        this.startTask = restored.startTask;
        this.endTask = restored.endTask;
        this.state = restored.state;
    }
}

export const gridPlan = new GridPlan();

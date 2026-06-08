import { jaiaGlobal } from "../jaia_global/jaia-global";
import { clampInput } from "../../utils/input";
import {
    NO_CONSTRAINT,
    TASK_ZERO_LOWER_BOUND,
    TASK_MAX_DEPTH_CONSTRAINT,
    TASK_MAX_HOLD_TIME_CONSTRAINT,
    TASK_MAX_HEADING_CONSTRAINT,
    TASK_MAX_SPEED_CONSTRAINT,
    TASK_MIN_SPEED_CONSTRAINT,
} from "../../utils/constants";
import { TaskParameterKeys, TaskParameterPair } from "../../types/jaia-system-types";
import {
    ConstantHeadingParameters,
    DiveParameters,
    DriftParameters,
    MissionTask,
    StationKeepParameters,
    TaskType,
} from "../../types/protobuf-types";

export default class Task {
    private type: TaskType;

    // Parameters //
    private diveParameters: DiveParameters;
    private driftParameters: DriftParameters;
    private constantHeadingParameters: ConstantHeadingParameters;
    private stationKeepParameters: StationKeepParameters;
    private safetyDepth: number;

    private isBottomDive: boolean;
    private useHydrophone: boolean;
    private isSurveyTask: boolean;

    constructor(isSurveyTask: boolean = false) {
        this.type = TaskType.NONE;
        const defaults = jaiaGlobal.getDefaultTaskParameters();
        this.setDiveParameters(defaults.dive);
        this.setDriftParameters(defaults.drift);
        this.setConstantHeadingParameters(defaults.constantHeading);
        this.safetyDepth = TASK_ZERO_LOWER_BOUND;
        this.setStationKeepParameters(defaults.stationKeep);
        this.isBottomDive = false;
        this.useHydrophone = false;
        this.isSurveyTask = isSurveyTask;
    }

    getType() {
        return this.type;
    }

    /**
     * Initializes the task parameters when an operator selects a new task
     *
     * @param {TaskType} type Name of selected task
     * @returns {void}
     */
    setType(type: TaskType) {
        const defaults = jaiaGlobal.getDefaultTaskParameters();

        switch (type) {
            case TaskType.DIVE:
                this.setDiveParameters(defaults.dive);
                this.setDriftParameters(defaults.drift);
                break;
            case TaskType.SURFACE_DRIFT:
                this.setDriftParameters(defaults.drift);
                break;
            case TaskType.CONSTANT_HEADING:
                this.setConstantHeadingParameters(defaults.constantHeading);
                break;
            case TaskType.STATION_KEEP:
                this.setStationKeepParameters(defaults.stationKeep);
                break;
        }

        this.type = type;
    }

    /**
     * Handles inputs made by the operator to change task parameters
     *
     * @param {TaskParameterPair} taskParameterPair Name of parameter + its value
     * @returns {void}
     */
    setParameter(taskParameterPair: TaskParameterPair) {
        const key = taskParameterPair.key;
        let value = taskParameterPair.value;

        if (!value) {
            value = TASK_ZERO_LOWER_BOUND;
        }

        switch (key) {
            case TaskParameterKeys.MAX_DEPTH:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_DEPTH_CONSTRAINT);
                this.diveParameters.max_depth = value;
                break;
            case TaskParameterKeys.DEPTH_INTERVAL:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_DEPTH_CONSTRAINT);
                this.diveParameters.depth_interval = value;
                break;
            case TaskParameterKeys.HOLD_TIME:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_HOLD_TIME_CONSTRAINT);
                this.diveParameters.hold_time = value;
                break;
            case TaskParameterKeys.DRIFT_TIME:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, NO_CONSTRAINT);
                this.driftParameters.drift_time = value;
                break;
            case TaskParameterKeys.HEADING:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, TASK_MAX_HEADING_CONSTRAINT);
                this.constantHeadingParameters.constant_heading = value;
                break;
            case TaskParameterKeys.CONSTANT_HEADING_TIME:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, NO_CONSTRAINT);
                this.constantHeadingParameters.constant_heading_time = value;
                break;
            case TaskParameterKeys.SPEED:
                value = clampInput(value, TASK_MIN_SPEED_CONSTRAINT, TASK_MAX_SPEED_CONSTRAINT);
                this.constantHeadingParameters.constant_heading_speed = value;
                break;
            case TaskParameterKeys.STATION_KEEP_TIME:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, NO_CONSTRAINT);
                this.stationKeepParameters.station_keep_time = value;
                break;
            case TaskParameterKeys.SAFETY_DEPTH:
                value = clampInput(value, TASK_ZERO_LOWER_BOUND, NO_CONSTRAINT);
                this.safetyDepth = value;
                break;
        }

        this.updateDefaultTaskParameters();
    }

    private updateDefaultTaskParameters() {
        jaiaGlobal.setDefaultTaskParameters({
            dive: this.diveParameters,
            drift: this.driftParameters,
            constantHeading: this.constantHeadingParameters,
            stationKeep: this.stationKeepParameters,
        });
    }

    getDiveParameters() {
        return this.diveParameters;
    }

    setDiveParameters(diveParameters: DiveParameters) {
        this.diveParameters = { ...diveParameters };
    }

    getDriftParameters() {
        return this.driftParameters;
    }

    setDriftParameters(driftParameters: DriftParameters) {
        this.driftParameters = { ...driftParameters };
    }

    getConstantHeadingParameters() {
        return this.constantHeadingParameters;
    }

    setConstantHeadingParameters(constantHeadingParameters: ConstantHeadingParameters) {
        this.constantHeadingParameters = { ...constantHeadingParameters };
    }

    getStationKeepParameters() {
        return this.stationKeepParameters;
    }

    setStationKeepParameters(stationKeepParameters: StationKeepParameters) {
        this.stationKeepParameters = { ...stationKeepParameters };
    }

    getSafetyDepth() {
        return this.safetyDepth;
    }

    getIsBottomDive() {
        return this.isBottomDive;
    }

    /**
     * Sets the isBottomDive property + configures the dive parameters accordingly.
     * The setting of the dive parameters does not update the default parameters because
     * when the toggle is switched off, we do not want to leave the operator with the
     * max parameters.
     *
     * @param {Boolean} isBottomDive The new state of the toggle
     * @returns {void}
     */
    setIsBottomDive(isBottomDive: boolean) {
        if (isBottomDive) {
            this.setDiveParameters({
                max_depth: TASK_MAX_DEPTH_CONSTRAINT,
                depth_interval: TASK_MAX_DEPTH_CONSTRAINT,
                hold_time: 0,
            });
        } else {
            this.setDiveParameters(jaiaGlobal.getDefaultTaskParameters().dive);
        }

        this.isBottomDive = isBottomDive;
    }

    getUseHydrophone() {
        return this.useHydrophone;
    }

    setUseHydrophone(useHydrophone: boolean) {
        this.useHydrophone = useHydrophone;
    }

    getIsSurveyTask() {
        return this.isSurveyTask;
    }

    setIsSurveyTask(isSurveyTask: boolean) {
        this.isSurveyTask = isSurveyTask;
    }

    /**
     * Formats the Task object into the MissionTask structure
     * that is used on the Hub/Bot.
     *
     * @returns {MissionTask} Task data formated for the Hub/Bot
     */
    packageTaskForHub() {
        const missionTask: MissionTask = {
            type: this.type,
        };

        switch (this.type) {
            case TaskType.DIVE:
                missionTask.dive = this.getDiveParameters();
                missionTask.surface_drift = this.driftParameters;
                break;
            case TaskType.SURFACE_DRIFT:
                missionTask.surface_drift = this.driftParameters;
                break;
            case TaskType.CONSTANT_HEADING:
                missionTask.constant_heading = this.constantHeadingParameters;
                break;
            case TaskType.STATION_KEEP:
                missionTask.station_keep = this.stationKeepParameters;
                break;
        }
        missionTask.start_pam = this.useHydrophone;
        return missionTask;
    }
}

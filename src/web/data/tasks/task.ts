import { jaiaGlobal } from "../jaia_global/jaia-global";
import { TaskParameterKeys, TaskParameterPair } from "../../types/jaia-system-types";
import {
    ConstantHeadingParameters,
    DiveParameters,
    DriftParameters,
    MissionTask,
    TaskType,
} from "../../types/protobuf-types";

export default class Task {
    private type: TaskType;

    // Parameters //
    private diveParameters: DiveParameters;
    private driftParameters: DriftParameters;
    private constantHeadingParameters: ConstantHeadingParameters;

    // Parameter Constraints //
    NO_CONSTRAINT = -1;
    ZERO_LOWER_BOUND = 0;

    // Dive
    MAX_DEPTH_CONSTRAINT = 50;
    MAX_HOLD_TIME_CONSTRAINT = 120;

    // Constant Heading
    MAX_HEADING_CONSTRAINT = 360;
    MIN_SPEED_CONSTRAINT = 1;
    MAX_SPEED_CONSTRAINT = 3;

    private isBottomDive: boolean;
    private isEnablePAM: boolean;

    constructor() {
        this.type = TaskType.NONE;
        const defaults = jaiaGlobal.getDefaultTaskParameters();
        this.setDiveParameters(defaults.dive);
        this.setDriftParameters(defaults.drift);
        this.setConstantHeadingParameters(defaults.constantHeading);
        this.isBottomDive = false;
        this.isEnablePAM = false;
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

        switch (key) {
            case TaskParameterKeys.MAX_DEPTH:
                value = this.validateInput(value, this.ZERO_LOWER_BOUND, this.MAX_DEPTH_CONSTRAINT);
                this.diveParameters.max_depth = value;
                break;
            case TaskParameterKeys.DEPTH_INTERVAL:
                value = this.validateInput(value, this.ZERO_LOWER_BOUND, this.MAX_DEPTH_CONSTRAINT);
                this.diveParameters.depth_interval = value;
                break;
            case TaskParameterKeys.HOLD_TIME:
                value = this.validateInput(
                    value,
                    this.ZERO_LOWER_BOUND,
                    this.MAX_HOLD_TIME_CONSTRAINT,
                );
                this.diveParameters.hold_time = value;
                break;
            case TaskParameterKeys.DRIFT_TIME:
                value = this.validateInput(value, this.ZERO_LOWER_BOUND, this.NO_CONSTRAINT);
                this.driftParameters.drift_time = value;
                break;
            case TaskParameterKeys.HEADING:
                value = this.validateInput(
                    value,
                    this.ZERO_LOWER_BOUND,
                    this.MAX_HEADING_CONSTRAINT,
                );
                this.constantHeadingParameters.constant_heading = value;
                break;
            case TaskParameterKeys.CONSTANT_HEADING_TIME:
                value = this.validateInput(value, this.ZERO_LOWER_BOUND, this.NO_CONSTRAINT);
                this.constantHeadingParameters.constant_heading_time = value;
                break;
            case TaskParameterKeys.SPEED:
                value = this.validateInput(
                    value,
                    this.MIN_SPEED_CONSTRAINT,
                    this.MAX_SPEED_CONSTRAINT,
                );
                this.constantHeadingParameters.constant_heading_speed = value;
                break;
        }

        this.updateDefaultTaskParameters();
    }

    /**
     * Clamps a number between a provided min and max. If the bound is infinity,
     * pass this.NO_CONSTRAINT.
     *
     * @param {number} value Number to be validated
     * @param {number} min Lower bound
     * @param {number} max Upper bound
     * @returns {number} Clamped value
     */
    private validateInput(value: number, min: number, max: number) {
        if (value > max && max !== this.NO_CONSTRAINT) {
            return max;
        }

        if (value < min && min !== this.NO_CONSTRAINT) {
            return min;
        }

        return value;
    }

    private updateDefaultTaskParameters() {
        jaiaGlobal.setDefaultTaskParameters({
            dive: this.getDiveParameters(),
            drift: this.getDriftParameters(),
            constantHeading: this.getConstantHeadingParameters(),
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
                max_depth: this.MAX_DEPTH_CONSTRAINT,
                depth_interval: this.MAX_DEPTH_CONSTRAINT,
                hold_time: 0,
            });
        } else {
            this.setDiveParameters(jaiaGlobal.getDefaultTaskParameters().dive);
        }

        this.isBottomDive = isBottomDive;
    }

    getIsEnablePAM() {
        return this.isEnablePAM;
    }

    setIsEnablePAM(isEnablePAM: boolean) {
        this.isEnablePAM = isEnablePAM;
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
                missionTask.surface_drift = this.getDriftParameters();
                break;
            case TaskType.SURFACE_DRIFT:
                missionTask.surface_drift = this.getDriftParameters();
                break;
            case TaskType.CONSTANT_HEADING:
                missionTask.constant_heading = this.getConstantHeadingParameters();
                break;
        }

        return missionTask;
    }
}

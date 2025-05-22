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

    // Dive
    MIN_DEPTH_CONSTRAINT = 0;
    MAX_DEPTH_CONSTRAINT = 50;
    MIN_HOLD_TIME_CONSTRAINT = 0;
    MAX_HOLD_TIME_CONSTRAINT = 120;

    // Drift
    MIN_DRIFT_TIME_CONSTRAINT = 0;

    // Constant Heading
    MIN_HEADING_CONSTRAINT = 0;
    MAX_HEADING_CONSTRAINT = 360;
    MIN_CONSTANT_HEADING_TIME_CONSTRAINT = 0;
    MIN_SPEED_CONSTRAINT = 1;
    MAX_SPEED_CONSTRAINT = 3;

    private isEnablePAM: boolean;

    constructor() {
        this.type = TaskType.NONE;
        const defaults = jaiaGlobal.getDefaultTaskParameters();
        this.setDiveParameters(defaults.dive);
        this.setDriftParameters(defaults.drift);
        this.setConstantHeadingParameters(defaults.constantHeading);
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
                value = this.validateInput(
                    value,
                    this.MIN_DEPTH_CONSTRAINT,
                    this.MAX_DEPTH_CONSTRAINT,
                );
                this.diveParameters.max_depth = value;
                break;
            case TaskParameterKeys.DEPTH_INTERVAL:
                value = this.validateInput(
                    value,
                    this.MIN_DEPTH_CONSTRAINT,
                    this.MAX_DEPTH_CONSTRAINT,
                );
                this.diveParameters.depth_interval = value;
                break;
            case TaskParameterKeys.HOLD_TIME:
                value = this.validateInput(
                    value,
                    this.MIN_HOLD_TIME_CONSTRAINT,
                    this.MAX_HOLD_TIME_CONSTRAINT,
                );
                this.diveParameters.hold_time = value;
                break;
            case TaskParameterKeys.DRIFT_TIME:
                value = this.validateInput(
                    value,
                    this.MIN_DRIFT_TIME_CONSTRAINT,
                    this.NO_CONSTRAINT,
                );
                this.driftParameters.drift_time = value;
                break;
            case TaskParameterKeys.HEADING:
                value = this.validateInput(
                    value,
                    this.MIN_HEADING_CONSTRAINT,
                    this.MAX_HEADING_CONSTRAINT,
                );
                this.constantHeadingParameters.constant_heading = value;
                break;
            case TaskParameterKeys.CONSTANT_HEADING_TIME:
                value = this.validateInput(
                    value,
                    this.MIN_CONSTANT_HEADING_TIME_CONSTRAINT,
                    this.NO_CONSTRAINT,
                );
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

    getIsEnablePAM() {
        return this.isEnablePAM;
    }

    setIsEnablePAM(isEnablePAM: boolean) {
        this.isEnablePAM = isEnablePAM;
    }

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

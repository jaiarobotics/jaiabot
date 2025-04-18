import { TaskType } from "../../types/protobuf-types";
import { TaskParameterKeys, TaskParameterPair } from "../../types/jaia-system-types";
import { jaiaGlobal } from "../jaia_global/jaia-global";

export default class Task {
    private type: TaskType;

    // Dive Parameters
    private maxDepth: number;
    private depthInterval: number;
    private holdTime: number;

    // Drift Parameters
    private driftTime: number;

    // Constant Heading Parameters
    private heading: number;
    private constantHeadingTime: number;
    private speed: number;

    // Parameter Constraints
    MIN_DEPTH = 0;
    MAX_DEPTH = 50;
    MIN_HOLD_TIME = 0;
    MAX_HOLD_TIME = 120;

    MIN_DRIFT_TIME = 0;

    MIN_HEADING = 0;
    MAX_HEADING = 360;
    MIN_CONSTANT_HEADING_TIME = 0;
    MIN_SPEED = 1;
    MAX_SPEED = 3;

    private isEnablePAM: boolean;

    constructor() {}

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
        const defaultParams = jaiaGlobal.getDefaultTaskParameters();

        switch (type) {
            case TaskType.DIVE:
                this.maxDepth = defaultParams.maxDepth;
                this.depthInterval = defaultParams.depthInterval;
                this.holdTime = defaultParams.holdTime;
                this.driftTime = defaultParams.driftTime;
                break;
            case TaskType.SURFACE_DRIFT:
                this.driftTime = defaultParams.driftTime;
                break;
            case TaskType.CONSTANT_HEADING:
                this.heading = defaultParams.heading;
                this.constantHeadingTime = defaultParams.constantHeadingTime;
                this.speed = defaultParams.speed;
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
        const mutableDefaults = { ...jaiaGlobal.getDefaultTaskParameters() };

        switch (key) {
            case TaskParameterKeys.MAX_DEPTH:
                this.setMaxDepth(value);
                mutableDefaults.maxDepth = value;
                break;
            case TaskParameterKeys.DEPTH_INTERVAL:
                this.setDepthInterval(value);
                mutableDefaults.depthInterval = this.depthInterval;
                break;
            case TaskParameterKeys.HOLD_TIME:
                this.setHoldTime(value);
                mutableDefaults.holdTime = this.holdTime;
                break;
            case TaskParameterKeys.DRIFT_TIME:
                this.setDriftTime(value);
                mutableDefaults.driftTime = this.driftTime;
                break;
            case TaskParameterKeys.HEADING:
                this.setHeading(value);
                mutableDefaults.heading = this.heading;
                break;
            case TaskParameterKeys.CONSTANT_HEADING_TIME:
                this.setConstantHeadingTime(value);
                mutableDefaults.constantHeadingTime = this.constantHeadingTime;
                break;
            case TaskParameterKeys.SPEED:
                this.setSpeed(value);
                mutableDefaults.speed = this.speed;
                break;
        }

        jaiaGlobal.setDefaultTaskParameters(mutableDefaults);
    }

    getMaxDepth() {
        return this.maxDepth;
    }

    setMaxDepth(maxDepth: number) {
        if (maxDepth > this.MAX_DEPTH) {
            maxDepth = this.MAX_DEPTH;
        }

        if (maxDepth < this.MIN_DEPTH) {
            maxDepth = this.MIN_DEPTH;
        }

        this.maxDepth = maxDepth;
    }

    getDepthInterval() {
        return this.depthInterval;
    }

    setDepthInterval(depthInterval: number) {
        if (depthInterval > this.MAX_DEPTH) {
            depthInterval = this.MAX_DEPTH;
        }

        if (depthInterval < this.MIN_DEPTH) {
            depthInterval = this.MIN_DEPTH;
        }

        this.depthInterval = depthInterval;
    }

    getHoldTime() {
        return this.holdTime;
    }

    setHoldTime(holdTime: number) {
        if (holdTime > this.MAX_HOLD_TIME) {
            holdTime = this.MAX_HOLD_TIME;
        }

        if (holdTime < this.MIN_HOLD_TIME) {
            holdTime = this.MIN_HOLD_TIME;
        }

        this.holdTime = holdTime;
    }

    getDriftTime() {
        return this.driftTime;
    }

    setDriftTime(driftTime: number) {
        if (driftTime < this.MIN_DRIFT_TIME) {
            driftTime = this.MIN_DRIFT_TIME;
        }

        this.driftTime = driftTime;
    }

    getHeading() {
        return this.heading;
    }

    setHeading(heading: number) {
        if (heading > this.MAX_HEADING) {
            heading = this.MAX_HEADING;
        }

        if (heading < this.MIN_HEADING) {
            heading = this.MIN_HEADING;
        }

        this.heading = heading;
    }

    getConstantHeadingTime() {
        return this.constantHeadingTime;
    }

    setConstantHeadingTime(constantHeadingTime: number) {
        if (constantHeadingTime < this.MIN_CONSTANT_HEADING_TIME) {
            constantHeadingTime = this.MIN_CONSTANT_HEADING_TIME;
        }

        this.constantHeadingTime = constantHeadingTime;
    }

    getSpeed() {
        return this.speed;
    }

    setSpeed(speed: number) {
        if (speed > this.MAX_SPEED) {
            speed = this.MAX_SPEED;
        }

        if (speed < this.MIN_SPEED) {
            speed = this.MIN_SPEED;
        }

        this.speed = speed;
    }

    getIsEnablePAM() {
        return this.isEnablePAM;
    }

    setIsEnablePAM(isEnablePAM: boolean) {
        this.isEnablePAM = isEnablePAM;
    }
}

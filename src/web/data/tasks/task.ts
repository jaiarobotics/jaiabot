import { TaskType } from "../../types/protobuf-types";
import { TaskParameterKeys, TaskParameterPair } from "../../types/jaia-system-types";
import { jaiaGlobal } from "../jaia_global/jaia-global";

export default class Task {
    private type: TaskType;

    // Dive Parameters
    private maxDepth: number;
    private depthInterval: number;
    private holdTime: number;

    private isEnablePAM: boolean;

    constructor() {}

    getType() {
        return this.type;
    }

    setType(type: TaskType) {
        const defaultParams = jaiaGlobal.getDefaultTaskParameters();

        switch (type) {
            case TaskType.DIVE:
                this.setMaxDepth(defaultParams.maxDepth);
                this.setDepthInterval(defaultParams.depthInterval);
                this.setHoldTime(defaultParams.holdTime);
        }

        this.type = type;
    }

    setParameter(taskParameterPair: TaskParameterPair) {
        const key = taskParameterPair.key;
        const value = taskParameterPair.value;
        const mutableDefaults = { ...jaiaGlobal.getDefaultTaskParameters() };

        switch (key) {
            case TaskParameterKeys.MAX_DEPTH:
                this.setMaxDepth(value);
                mutableDefaults.maxDepth = value;
            case TaskParameterKeys.DEPTH_INTERVAL:
                this.setDepthInterval(value);
            case TaskParameterKeys.HOLD_TIME:
                this.setHoldTime(value);
        }

        jaiaGlobal.setDefaultTaskParameters(mutableDefaults);
    }

    getMaxDepth() {
        return this.maxDepth;
    }

    private setMaxDepth(maxDepth: number) {
        this.maxDepth = maxDepth;
    }

    getDepthInterval() {
        return this.depthInterval;
    }

    private setDepthInterval(depthInterval: number) {
        this.depthInterval = depthInterval;
    }

    getHoldTime() {
        return this.holdTime;
    }

    private setHoldTime(holdTime: number) {
        this.holdTime = holdTime;
    }

    getIsEnablePAM() {
        return this.isEnablePAM;
    }

    setIsEnablePAM(isEnablePAM: boolean) {
        this.isEnablePAM = isEnablePAM;
    }
}

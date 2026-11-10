import { jaiaGlobal } from "../jaia_global/jaia-global";
import {
    clampTaskParameter,
    clampTaskParameters,
    depthIntervalForBot,
    TaskParameterFields,
} from "../../utils/input";
import { TASK_ZERO_LOWER_BOUND, TASK_MAX_DEPTH_CONSTRAINT } from "../../utils/constants";
import { TaskParameterKeys, TaskParameterPair } from "../../types/jaia-system-types";
import {
    MissionTask,
    MissionTask_ConstantHeadingParameters,
    MissionTask_DiveParameters,
    MissionTask_DriftParameters,
    MissionTask_StationKeepParameters,
    MissionTask_TaskType,
} from "@proto/jaiabot/messages/mission";

const DIVE_FIELDS: TaskParameterFields<MissionTask_DiveParameters> = {
    max_depth: TaskParameterKeys.MAX_DEPTH,
    depth_interval: TaskParameterKeys.DEPTH_INTERVAL,
    hold_time: TaskParameterKeys.HOLD_TIME,
};
const DRIFT_FIELDS: TaskParameterFields<MissionTask_DriftParameters> = {
    drift_time: TaskParameterKeys.DRIFT_TIME,
};
const CONSTANT_HEADING_FIELDS: TaskParameterFields<MissionTask_ConstantHeadingParameters> = {
    constant_heading: TaskParameterKeys.HEADING,
    constant_heading_time: TaskParameterKeys.CONSTANT_HEADING_TIME,
    constant_heading_speed: TaskParameterKeys.SPEED,
};
const STATION_KEEP_FIELDS: TaskParameterFields<MissionTask_StationKeepParameters> = {
    station_keep_time: TaskParameterKeys.STATION_KEEP_TIME,
};

export default class Task {
    private type: MissionTask_TaskType;

    // Parameters //
    private diveParameters: MissionTask_DiveParameters;
    private driftParameters: MissionTask_DriftParameters;
    private constantHeadingParameters: MissionTask_ConstantHeadingParameters;
    private stationKeepParameters: MissionTask_StationKeepParameters;
    private safetyDepth: number;

    private isBottomDive: boolean;
    private useHydrophone: boolean;
    private isSurveyTask: boolean;

    constructor(isSurveyTask: boolean = false) {
        this.type = MissionTask_TaskType.NONE;
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
     * @param {MissionTask_TaskType} type Name of selected task
     * @returns {void}
     */
    setType(type: MissionTask_TaskType) {
        const defaults = jaiaGlobal.getDefaultTaskParameters();

        switch (type) {
            case MissionTask_TaskType.DIVE:
                this.setDiveParameters(defaults.dive);
                this.setDriftParameters(defaults.drift);
                break;
            case MissionTask_TaskType.SURFACE_DRIFT:
                this.setDriftParameters(defaults.drift);
                break;
            case MissionTask_TaskType.CONSTANT_HEADING:
                this.setConstantHeadingParameters(
                    clampTaskParameters(
                        defaults.constantHeading,
                        CONSTANT_HEADING_FIELDS,
                        this.isSafetyReturnTask(),
                    ),
                );
                break;
            case MissionTask_TaskType.STATION_KEEP:
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
        const value = clampTaskParameter(key, taskParameterPair.value, this.isSafetyReturnTask());

        switch (key) {
            case TaskParameterKeys.MAX_DEPTH:
                this.diveParameters.max_depth = value;
                break;
            case TaskParameterKeys.DEPTH_INTERVAL:
                this.diveParameters.depth_interval = value;
                break;
            case TaskParameterKeys.HOLD_TIME:
                this.diveParameters.hold_time = value;
                break;
            case TaskParameterKeys.DRIFT_TIME:
                this.driftParameters.drift_time = value;
                break;
            case TaskParameterKeys.HEADING:
                this.constantHeadingParameters.constant_heading = value;
                break;
            case TaskParameterKeys.CONSTANT_HEADING_TIME:
                this.constantHeadingParameters.constant_heading_time = value;
                break;
            case TaskParameterKeys.SPEED:
                this.constantHeadingParameters.constant_heading_speed = value;
                break;
            case TaskParameterKeys.STATION_KEEP_TIME:
                this.stationKeepParameters.station_keep_time = value;
                break;
            case TaskParameterKeys.SAFETY_DEPTH:
                this.safetyDepth = value;
                break;
        }

        this.updateDefaultTaskParameters();
    }

    private updateDefaultTaskParameters() {
        let diveParams = { ...this.diveParameters };
        // Do not update default dive parameters if we have a bottom dive
        if (diveParams.max_depth === TASK_MAX_DEPTH_CONSTRAINT) {
            diveParams = jaiaGlobal.getDefaultTaskParameters().dive;
        }
        jaiaGlobal.setDefaultTaskParameters({
            dive: diveParams,
            drift: this.driftParameters,
            constantHeading: this.constantHeadingParameters,
            stationKeep: this.stationKeepParameters,
        });
    }

    getDiveParameters() {
        return this.diveParameters;
    }

    setDiveParameters(diveParameters: MissionTask_DiveParameters) {
        this.diveParameters = { ...diveParameters };
    }

    getDriftParameters() {
        return this.driftParameters;
    }

    setDriftParameters(driftParameters: MissionTask_DriftParameters) {
        this.driftParameters = { ...driftParameters };
    }

    getConstantHeadingParameters() {
        return this.constantHeadingParameters;
    }

    setConstantHeadingParameters(constantHeadingParameters: MissionTask_ConstantHeadingParameters) {
        this.constantHeadingParameters = { ...constantHeadingParameters };
    }

    getStationKeepParameters() {
        return this.stationKeepParameters;
    }

    setStationKeepParameters(stationKeepParameters: MissionTask_StationKeepParameters) {
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
     * Whether the parameters are a survey's safety return (BottomDepthSafetyParams), which
     * allows less constant heading time than a MissionTask
     *
     * @returns {boolean} False for a waypoint or survey task
     */
    protected isSafetyReturnTask() {
        return false;
    }

    /**
     * Formats the Task object into the MissionTask structure
     * that is used on the Hub/Bot, with each parameter clamped to its bounds in mission.proto.
     *
     * @returns {MissionTask} Task data formated for the Hub/Bot
     */
    packageTaskForHub() {
        const missionTask: MissionTask = {
            type: this.type,
        };

        switch (this.type) {
            case MissionTask_TaskType.DIVE:
                missionTask.dive = clampTaskParameters(this.getDiveParameters(), DIVE_FIELDS);
                if (missionTask.dive.depth_interval !== undefined) {
                    missionTask.dive.depth_interval = depthIntervalForBot(
                        missionTask.dive.depth_interval,
                    );
                }
                missionTask.surface_drift = clampTaskParameters(this.driftParameters, DRIFT_FIELDS);
                break;
            case MissionTask_TaskType.SURFACE_DRIFT:
                missionTask.surface_drift = clampTaskParameters(this.driftParameters, DRIFT_FIELDS);
                break;
            case MissionTask_TaskType.CONSTANT_HEADING:
                missionTask.constant_heading = clampTaskParameters(
                    this.constantHeadingParameters,
                    CONSTANT_HEADING_FIELDS,
                );
                break;
            case MissionTask_TaskType.STATION_KEEP:
                missionTask.station_keep = clampTaskParameters(
                    this.stationKeepParameters,
                    STATION_KEEP_FIELDS,
                );
                break;
        }
        missionTask.start_pam = this.useHydrophone;
        return missionTask;
    }
}

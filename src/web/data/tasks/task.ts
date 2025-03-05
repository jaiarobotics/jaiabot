import { TaskType } from "../../types/protobuf-types";
import { jaiaGlobal } from "../jaia_global/jaia-global";
import {
    DiveParameters,
    DriftParameters,
    ConstantHeadingParameters,
    StationKeepParameters,
} from "../../types/protobuf-types";

export default class Task {
    private type: TaskType;
    private diveParameters: DiveParameters;
    private driftParameters: DriftParameters;
    private constantHeadingParameters: ConstantHeadingParameters;
    private stationKeepParameters: StationKeepParameters;
    private isEnablePAM: boolean;

    constructor() {}

    getType() {
        return this.type;
    }

    setType(type: TaskType) {
        const defaultParams = jaiaGlobal.getDefaultTaskParameters();

        switch (type) {
            case TaskType.DIVE:
                this.setDiveParameters(defaultParams.dive);
                this.setDriftParameters(defaultParams.drift);
                break;
            case TaskType.SURFACE_DRIFT:
                this.setDriftParameters(defaultParams.drift);
                break;
            case TaskType.CONSTANT_HEADING:
                this.setConstantHeadingParameters(defaultParams.constantHeading);
                break;
            case TaskType.STATION_KEEP:
                this.setStationKeepParameters(defaultParams.stationKeep);
                break;
        }
        this.type = type;
    }

    getDiveParameters() {
        return this.diveParameters;
    }

    setDiveParameters(diveParameters: DiveParameters) {
        this.diveParameters = diveParameters;
    }

    getDriftParameters() {
        return this.driftParameters;
    }

    setDriftParameters(driftParameters: DriftParameters) {
        this.driftParameters = driftParameters;
    }

    getConstantHeadingParameters() {
        return this.constantHeadingParameters;
    }

    setConstantHeadingParameters(constantHeadingParameters: ConstantHeadingParameters) {
        this.constantHeadingParameters = constantHeadingParameters;
    }

    getStationKeepParameters() {
        return this.stationKeepParameters;
    }

    setStationKeepParameters(stationKeepParameters: StationKeepParameters) {
        this.stationKeepParameters = stationKeepParameters;
    }

    getIsEnablePAM() {
        return this.isEnablePAM;
    }

    setIsEnablePAM(isEnablePAM: boolean) {
        this.isEnablePAM = isEnablePAM;
    }
}

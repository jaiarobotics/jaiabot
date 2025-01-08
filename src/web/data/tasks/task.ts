import { TaskType } from "../../utils/protobuf-types";
import ConstantHeadingParameters from "./parameters/constant-heading-parameters";
import DiveParameters from "./parameters/dive-parameters";
import DriftParameters from "./parameters/drift-parameters";
import StationKeepParameters from "./parameters/station-keep-parameters";

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

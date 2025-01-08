import Task from "../../tasks/task";
import DiveParameters from "../../tasks/parameters/dive-parameters";
import DriftParameters from "../../tasks/parameters/drift-parameters";
import StationKeepParameters from "../../tasks/parameters/station-keep-parameters";
import ConstantHeadingParameters from "../../tasks/parameters/constant-heading-parameters";

const diveParameters = new DiveParameters();
diveParameters.setMaxDepth(10);
diveParameters.setDepthInterval(10);
diveParameters.setHoldTime(60);

const bottomDiveParameters = new DiveParameters();
bottomDiveParameters.setIsBottomDive(true);

const driftParameters = new DriftParameters();
driftParameters.setTime(60);

const stationKeepParameters = new StationKeepParameters();
stationKeepParameters.setTime(60);

const constantHeadingParameters = new ConstantHeadingParameters();
constantHeadingParameters.setHeading(120);
constantHeadingParameters.setTime(60);
constantHeadingParameters.setSpeed(3);

const diveTask = new Task();
diveTask.setDiveParameters(diveParameters);

const bottomDiveTask = new Task();
bottomDiveTask.setDiveParameters(bottomDiveParameters);

const driftTask = new Task();
driftTask.setDriftParameters(driftParameters);

const diveDriftTask = new Task();
diveDriftTask.setDiveParameters(diveParameters);
diveDriftTask.setDriftParameters(driftParameters);

const stationKeepTask = new Task();
stationKeepTask.setStationKeepParameters(stationKeepParameters);

const constantHeadingTask = new Task();
constantHeadingTask.setConstantHeadingParameters(constantHeadingParameters);

export const tasks: Task[] = [
    diveTask,
    bottomDiveTask,
    driftTask,
    diveDriftTask,
    stationKeepTask,
    constantHeadingTask,
];

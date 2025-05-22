import Mission from "../mission";
import { locationA, locationB, locationC, locationD } from "../../tests/__mocks__/waypoint-mock";
import { missions } from "../missions";
import TaskParameters from "../../../components/TaskParameters/TaskParameters";
import Task from "../../tasks/task";
import {
    ConstantHeadingParameters,
    DiveParameters,
    DriftParameters,
    MissionTask,
    TaskType,
} from "../../../types/protobuf-types";
import { TaskParameterKeys, TaskParameterPair } from "../../../types/jaia-system-types";
import cloneDeep from "lodash/cloneDeep";

test("Clone a mission and test values", () => {
    let originalMission = new Mission();
    missions.addMission(originalMission);
    originalMission.addWaypoint(locationA);
    let waypoint1 = originalMission.getWaypoint(1);
    let task1 = new Task();
    task1.setType(TaskType.DIVE);
    task1.setParameter({ key: TaskParameterKeys.MAX_DEPTH, value: 13 });
    waypoint1.setTask(task1);

    let missionCopyLodash = cloneDeep(originalMission);
    expect(missionCopyLodash.getWaypoint(1).getLocation().lat).toEqual(locationA.lat);
    expect(missionCopyLodash.getWaypoint(1).getLocation().lon).toEqual(locationA.lon);
    expect(missionCopyLodash.getWaypoint(1).getTask().getType()).toEqual(TaskType.DIVE);
    expect(missionCopyLodash.getWaypoint(1).getTask().getDiveParameters().max_depth).toEqual(13);

    let missionCopyWindow = structuredClone(originalMission);

    //modify the original
    waypoint1.setLocation(locationB);
    task1.setParameter({ key: TaskParameterKeys.MAX_DEPTH, value: 24 });
});

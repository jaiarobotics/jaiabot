import Mission from "../mission";
import { locationA, locationB, locationC, locationD } from "../../tests/__mocks__/waypoint-mock";
import { missions } from "../missions";
import Task from "../../tasks/task";
import { TaskType } from "../../../types/protobuf-types";
import { TaskParameterKeys, TaskParameterPair } from "../../../types/jaia-system-types";
import cloneDeep from "lodash/cloneDeep";

test("Clone a mission and test values", () => {
    let originalMission = new Mission();
    const originalID: number = missions.addMission(originalMission);
    originalMission.addWaypoint(locationA);

    let waypoint1 = originalMission.getWaypoint(1);
    let task1 = new Task();
    task1.setType(TaskType.DIVE);
    task1.setParameter({ key: TaskParameterKeys.MAX_DEPTH, value: 13 });
    waypoint1.setTask(task1);

    // clone the mission and addit to the missions data
    let cloneMission = cloneDeep(originalMission);
    const cloneID: number = missions.addMission(cloneMission);
    expect(missions.getMissions().size).toEqual(2);
    expect(cloneID).not.toEqual(originalID);
    expect(missions.getMissionIDInEditMode()).toEqual(cloneID);

    expect(cloneMission.getWaypoint(1).getLocation().lat).toEqual(locationA.lat);
    expect(cloneMission.getWaypoint(1).getLocation().lon).toEqual(locationA.lon);
    expect(cloneMission.getWaypoint(1).getTask().getType()).toEqual(TaskType.DIVE);
    expect(cloneMission.getWaypoint(1).getTask().getDiveParameters().max_depth).toEqual(13);

    // modify the original location and max depth
    waypoint1.setLocation(locationB);
    task1.setParameter({ key: TaskParameterKeys.MAX_DEPTH, value: 24 });

    // verify the copy did not change
    expect(cloneMission.getWaypoint(1).getLocation().lat).toEqual(locationA.lat);
    expect(cloneMission.getWaypoint(1).getLocation().lon).toEqual(locationA.lon);
    expect(cloneMission.getWaypoint(1).getTask().getType()).toEqual(TaskType.DIVE);
    expect(cloneMission.getWaypoint(1).getTask().getDiveParameters().max_depth).toEqual(13);

    // modify the copy task type and parameters
    cloneMission.getWaypoint(1).getTask().setType(TaskType.CONSTANT_HEADING);
    cloneMission.getWaypoint(1).getTask().setConstantHeadingParameters({
        constant_heading: 234,
        constant_heading_time: 11,
        constant_heading_speed: 2.5,
    });

    // verify original did not change
    expect(originalMission.getWaypoint(1).getTask().getType()).toEqual(TaskType.DIVE);
    expect(
        originalMission.getWaypoint(1).getTask().getConstantHeadingParameters().constant_heading,
    ).not.toEqual(234);
    // verify the partameters are a different reference
    expect(originalMission.getWaypoint(1).getTask().getConstantHeadingParameters()).not.toEqual(
        cloneMission.getWaypoint(1).getTask().getConstantHeadingParameters(),
    );

    // add a waypoint to original mission
    originalMission.addWaypoint(locationC);
    expect(originalMission.getWaypoints().length).toEqual(2);

    // verfiy copy did not change
    expect(cloneMission.getWaypoints().length).toEqual(1);
});

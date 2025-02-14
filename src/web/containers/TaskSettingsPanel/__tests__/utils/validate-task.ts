import { MissionTask, TaskType } from "../../../../shared/JAIAProtobuf";
//Helper function to verify the task created by the Panel is valid
export function validateTask(task?: MissionTask): void {
    if (!task) {
        return;
    }
    switch (task?.type) {
        case TaskType.CONSTANT_HEADING:
            // Make sure all the parameters are defined
            expect(task.constant_heading).toBeDefined();
            expect(task.constant_heading.constant_heading).toBeDefined();
            expect(task.constant_heading.constant_heading_speed).toBeDefined();
            expect(task.constant_heading.constant_heading_time).toBeDefined();
            // None of these should be present
            expect(task.dive).toBeUndefined();
            expect(task.station_keep).toBeUndefined();
            expect(task.surface_drift).toBeUndefined();
            break;
        case TaskType.DIVE:
            expect(task.dive).toBeDefined();
            if (task.dive.bottom_dive) {
                // Bottom Dive = true, expect no other parameters
                expect(task.dive.max_depth).toBeUndefined();
                expect(task.dive.depth_interval).toBeUndefined();
                expect(task.dive.hold_time).toBeUndefined();
            } else {
                // Non-Bottom Dive should have other parameters
                expect(task.dive.max_depth).toBeDefined();
                expect(task.dive.depth_interval).toBeDefined();
                expect(task.dive.hold_time).toBeDefined();
            }
            expect(task.surface_drift).toBeDefined();
            // None of these should be present
            expect(task.station_keep).toBeUndefined();
            expect(task.constant_heading).toBeUndefined();
            break;
        case TaskType.SURFACE_DRIFT:
            expect(task.surface_drift).toBeDefined();
            expect(task.surface_drift.drift_time).toBeDefined();
            // None of these should be present
            expect(task.dive).toBeUndefined();
            expect(task.station_keep).toBeUndefined();
            expect(task.constant_heading).toBeUndefined();
            break;
        case TaskType.STATION_KEEP:
            expect(task.station_keep).toBeDefined();
            expect(task.station_keep.station_keep_time).toBeDefined();
            // None of these should be present
            expect(task.dive).toBeUndefined();
            expect(task.surface_drift).toBeUndefined();
            expect(task.constant_heading).toBeUndefined();
            break;
        case TaskType.NONE:
            // None of these should be present
            expect(task.constant_heading).toBeUndefined();
            expect(task.dive).toBeUndefined();
            expect(task.surface_drift).toBeUndefined();
            expect(task.station_keep).toBeUndefined();
            break;
        default:
            // Throw error if we get unexpected task type
            throw new Error(`Unhandled TaskType: ${task.type}`);
    }
}

describe("Placeholder to prevent jest from failing due to no explicit test for a file inside __test__ dir", () => {
    test("Placeholder test", () => {});
});

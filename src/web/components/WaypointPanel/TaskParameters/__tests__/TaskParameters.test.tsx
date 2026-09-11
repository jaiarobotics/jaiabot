import { render, screen } from "@testing-library/react";
import TaskParameters from "../TaskParameters";
import Task from "../../../../data/tasks/task";
import { MissionTask_TaskType } from "../../../../shared/proto/jaiabot/messages/mission";
import { jaiaGlobal } from "../../../../data/jaia_global/jaia-global";
import { TaskParameterKeys } from "../../../../types/jaia-system-types";

const mockTask: Task = new Task();

test("Render dive + drift parameters", () => {
    mockTask.setType(MissionTask_TaskType.DIVE);
    render(<TaskParameters task={mockTask} isDisabled={false} />);
    const depthParams = screen.getAllByDisplayValue(
        jaiaGlobal.getDefaultTaskParameters().dive.max_depth,
    );
    expect(depthParams[0]).toHaveAttribute("name", TaskParameterKeys.MAX_DEPTH);
    expect(depthParams[1]).toHaveAttribute("name", TaskParameterKeys.DEPTH_INTERVAL);
    const timeParams = screen.getAllByDisplayValue(
        jaiaGlobal.getDefaultTaskParameters().dive.hold_time,
    );
    expect(timeParams[0]).toHaveAttribute("name", TaskParameterKeys.HOLD_TIME);
    expect(timeParams[1]).toHaveAttribute("name", TaskParameterKeys.DRIFT_TIME);
});

test("Render drift parameters", () => {
    mockTask.setType(MissionTask_TaskType.SURFACE_DRIFT);
    render(<TaskParameters task={mockTask} isDisabled={false} />);
    const driftParams = screen.getByDisplayValue(
        jaiaGlobal.getDefaultTaskParameters().drift.drift_time,
    );
    expect(driftParams).toHaveAttribute("name", TaskParameterKeys.DRIFT_TIME);
});

test.skip("Render constant heading parameters", () => {
    mockTask.setType(MissionTask_TaskType.CONSTANT_HEADING);
    render(<TaskParameters task={mockTask} isDisabled={false} />);
    const heading = screen.getByDisplayValue(
        jaiaGlobal.getDefaultTaskParameters().constantHeading.constant_heading,
    );
    const time = screen.getByDisplayValue(
        jaiaGlobal.getDefaultTaskParameters().constantHeading.constant_heading_time,
    );
    const speed = screen.getByDisplayValue(
        jaiaGlobal.getDefaultTaskParameters().constantHeading.constant_heading_speed,
    );
    expect(heading).toHaveAttribute("name", TaskParameterKeys.HEADING);
    expect(time).toHaveAttribute("name", TaskParameterKeys.CONSTANT_HEADING_TIME);
    expect(speed).toHaveAttribute("name", TaskParameterKeys.SPEED);
});

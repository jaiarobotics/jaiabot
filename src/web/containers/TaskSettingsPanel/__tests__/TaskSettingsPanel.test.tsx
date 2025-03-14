import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TaskSettingsPanel, Props } from "../TaskSettingsPanel";
import { MissionTask, TaskType } from "../../../shared/JAIAProtobuf";
import { validateTask } from "./utils/validate-task";
import testCases from "./cases/missionTaskTestCases.json";

const defaultProps: Props = {
    isEditMode: true,
    enableEcho: false,
    onChange: (task?: MissionTask) => mockOnChange(task),
};

let mockProps: Props = defaultProps;

//Mock of the onChange callback to update Props
const mockOnChange = jest.fn().mockImplementation((task?: MissionTask) => {
    mockProps.task = task;
});

function resetProps() {
    mockProps = { ...defaultProps };
}

type TaskParams = {
    description: string;
    task: MissionTask;
};

type TaskTestCases = {
    validTaskTestCases: TaskParams[];
};

// Use all of the Valid Task Test Cases
const validTaskTestCases = (testCases as TaskTestCases).validTaskTestCases;

describe("TaskSettingsPanel: Should update task type correctly for all options", () => {
    beforeEach(() => {
        resetProps();
        jest.clearAllMocks(); // Ensure a clean state for each test
    });

    test.each(validTaskTestCases)(
        "Input Task: $description, Select all Options",
        async ({ task }) => {
            let onChangeCalls = 0;

            // Add Test Case Task to Props
            mockProps.task = task;

            // Task Settings Panel initializes the Select to None when no type is passed in
            let previousValue = task?.type ?? "NONE";

            // Get the rerender function from the object returned when rendering the panel
            const { rerender } = render(<TaskSettingsPanel {...mockProps} />);

            // Get the Select Component
            const selectElement: HTMLSelectElement = screen.getByTestId("task-select-input-id");
            expect(selectElement).toBeInTheDocument();

            // Verify the mockOnChange function hasn't been called yet
            expect(mockOnChange).toHaveBeenCalledTimes(0);

            // Verify that the selected value is Same as Props Task
            expect(selectElement.value).toBe(previousValue);

            // Change the Task Type to all options and verify the change occured
            for (const newValue of Object.values(TaskType)) {
                // Change the selection
                await userEvent.selectOptions(selectElement, newValue);

                // Rerender with updated props
                rerender(<TaskSettingsPanel {...mockProps} />);

                // Verify that the selected value is correct
                await waitFor(() => {
                    expect(selectElement.value).toBe(newValue);
                });

                if (newValue != previousValue) {
                    // Verify that mockOnChange was called with the correct task type
                    expect(mockOnChange).toHaveBeenLastCalledWith(
                        expect.objectContaining({
                            type: newValue,
                        }),
                    );
                    // Validate the TaskSettingsPanel sent a valid Task to mockOnChange
                    validateTask(mockProps.task);
                }
            }
        },
    );
});

describe("Unit Test Bottom Dive Toggle JAIA-1512", () => {
    beforeEach(() => {
        resetProps();
        jest.clearAllMocks(); // Ensure a clean state for each test
    });

    test("Toggle Bottom Dive, Verify Task", async () => {
        // Get the rerender function from the object returned when rendering the panel
        const { rerender } = render(<TaskSettingsPanel {...mockProps} />);

        // Get the Select Component
        const selectElement: HTMLSelectElement = screen.getByTestId("task-select-input-id");
        expect(selectElement).toBeInTheDocument();

        // Verify that the select value is None
        expect(selectElement.value).toBe("NONE");

        // Change Select to Dive
        await userEvent.selectOptions(selectElement, "DIVE");

        // Rerender with updated props
        rerender(<TaskSettingsPanel {...mockProps} />);

        // Verify that the select value is Dive
        waitFor(() => {
            expect(selectElement.value).toBe("DIVE");
        });

        // Verify that mockOnChange was called with non-bottom dive
        expect(mockOnChange).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: "DIVE",
                dive: expect.objectContaining({
                    bottom_dive: false,
                }),
            }),
        );
        // Validate the TaskSettingsPanel sent a valid task to mockOnChange
        validateTask(mockProps.task);

        // Get the Bottom Dive Toggle
        const bottomToggle = screen.getByTitle("Switch to Bottom Dive");

        // Verify Toggle is unchecked
        expect(bottomToggle).not.toBeChecked();

        // Change to Bottom Dive
        await userEvent.click(bottomToggle);

        // Rerender with updated props
        rerender(<TaskSettingsPanel {...mockProps} />);

        // Verify Toggle is checked
        waitFor(() => {
            expect(bottomToggle).toBeChecked();
        });

        // Verify that mockOnChange was called with a bottom dive
        expect(mockOnChange).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: "DIVE",
                dive: expect.objectContaining({
                    bottom_dive: true,
                }),
            }),
        );

        // Validate the TaskSettingsPanel created valid bottom dive task
        validateTask(mockProps.task);

        // Change Back to Non-Bottom Dive
        await userEvent.click(bottomToggle);

        // Rerender with updated props
        rerender(<TaskSettingsPanel {...mockProps} />);

        // Verify Toggle is unchecked
        waitFor(() => {
            expect(bottomToggle).not.toBeChecked();
        });

        // Verify that mockOnChange was called with non-bottom dive
        expect(mockOnChange).toHaveBeenLastCalledWith(
            expect.objectContaining({
                type: "DIVE",
                dive: expect.objectContaining({
                    bottom_dive: false,
                }),
            }),
        );

        // Validate the TaskSettingsPanel created valid nob-bottom dive task
        validateTask(mockProps.task);
    });
});

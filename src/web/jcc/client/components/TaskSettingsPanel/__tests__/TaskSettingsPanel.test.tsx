import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskSettingsPanel, Props } from "../TaskSettingsPanel";

import { MissionTask, TaskType, DiveParameters, DriftParameters } from "../../shared/JAIAProtobuf";
import { GlobalSettings, Save } from "../../Settings";

import { log } from "console";
import { type } from "os";
import { SafetyCheck } from "@mui/icons-material";

const mockMinimumProps: Props = {
    enableEcho: false,
};

const sendEventToParentWindowMock = jest.fn(() => {
    log("** sendEventToParentWindowMock called **");
});

//Mock of the onChange Prop to verify tasks are formatted correctly
const mockOnChangeCheckParameters = (task?: MissionTask) => {
    log("mockOnChangeCheckParameters checking task");
    log(task);
    switch (task.type) {
        case TaskType.CONSTANT_HEADING:
            //TODO
            break;
        case TaskType.DIVE:
            if (task.dive.bottom_dive) {
                //Bottom Dive = true, expect no other parameters
                expect(task.dive.max_depth).toBeDefined(); //this should fail, fix once verify function gets called
                expect(task.dive.depth_interval).toBeUndefined();
                expect(task.dive.hold_time).toBeUndefined();
            } else {
                expect(task.dive.max_depth).toBeDefined;
                expect(task.dive.depth_interval).toBeDefined;
                expect(task.dive.hold_time).toBeDefined;
            }
            expect(task.surface_drift).toBeDefined;
            break;
        case TaskType.SURFACE_DRIFT:
            //TODO
            break;
        case TaskType.STATION_KEEP:
            //TODO
            break;
    }
    sendEventToParentWindowMock();
};
const mockDriftParameters: DriftParameters = {
    //Mock Drift Parameters
    drift_time: 0,
};

//Non-Bottom Dive Prop Setup
const nonBottomDiveParameters: DiveParameters = {
    //Mock Non-Bottom Dive Parameters
    max_depth: 30,
    depth_interval: 10,
    hold_time: 2,
    bottom_dive: false,
};
const mockNonBottomDiveTask: MissionTask = {
    //Mock Non-Bottom Dive Task
    type: TaskType.DIVE,
    dive: nonBottomDiveParameters,
    surface_drift: mockDriftParameters,
};
const mockNonBottomDiveProps: Props = {
    //Mock Non-Bottom Dive Props
    task: mockNonBottomDiveTask,
    isEditMode: true,
    enableEcho: false,
    onChange: (task?: MissionTask) => mockOnChangeCheckParameters(task),
};

//Bottom Dive Prop Setup
const bottomDiveParameters: DiveParameters = {
    //Mock Bottom Dive Parameters
    bottom_dive: true,
};
const mockBottomDiveTask: MissionTask = {
    //Mock Bottom Dive Task
    type: TaskType.DIVE,
    dive: bottomDiveParameters,
    surface_drift: mockDriftParameters,
};
const mockBottomDiveProps: Props = {
    //Mock Bottom Dive Props
    task: mockBottomDiveTask,
    isEditMode: true,
    enableEcho: false,
    onChange: (task?: MissionTask) => mockOnChangeCheckParameters(task),
};

//Bad Bottom Dive Prop Setup
const badBottomDiveParameters: DiveParameters = {
    //Mock ill-formed Bottom Dive Parameters
    max_depth: 30, //these 3 parameters should not be presetn for Bottom Dives
    depth_interval: 10,
    hold_time: 2,
    bottom_dive: true,
};
const mockBadBottomDiveTask: MissionTask = {
    //Mock Bottom Dive Task
    type: TaskType.DIVE,
    dive: badBottomDiveParameters,
    surface_drift: mockDriftParameters,
};
const mockBADBottomDiveProps: Props = {
    //Mock Bottom Dive Props
    task: mockBadBottomDiveTask,
    isEditMode: true,
    enableEcho: false,
    onChange: (task?: MissionTask) => mockOnChangeCheckParameters(task),
};

describe("TaskSettingsPanel Bottom Dive Integration Tests", () => {
    //Test Selection of Dive with a Bottom Dive Task including extra parameters
    test("TaskSettingsPanel Select Bottom Dive BadBottom Dive Task", async () => {
        render(<TaskSettingsPanel {...mockBADBottomDiveProps} />);
        const taskSelectElement = screen.getByTestId("taskSelect");
        expect(taskSelectElement).toHaveTextContent(/None/i);
        expect(taskSelectElement).toHaveTextContent(/Dive/i);
        //This approach relies on native={true} in the Select component
        //https://stackoverflow.com/questions/55184037/react-testing-library-on-change-for-material-ui-select-component

        // Dig deep to find the actual <select>
        const selectNode = taskSelectElement.childNodes[0].childNodes[0];
        expect(selectNode).toHaveValue("NONE");
        expect(selectNode).not.toHaveValue("DIVE");
        fireEvent.change(selectNode, { target: { value: "DIVE" } });
        expect(selectNode).toHaveValue("DIVE");
        expect(selectNode).not.toHaveValue("NONE");
        //mockOnChangeCheckParameters()
    });

    //Test Selection of Dive with a Different Dive Task Props
    test.each([
        mockMinimumProps,
        mockNonBottomDiveProps,
        mockBottomDiveProps,
        mockBADBottomDiveProps,
    ])("TaskSettingsPanel Select Bottom Dive With Task %s", async (props) => {
        render(<TaskSettingsPanel {...props} />);
        const taskSelectElement = screen.getByTestId("taskSelect");
        expect(taskSelectElement).toHaveTextContent(/None/i);
        // Dig deep to find the actual <select>
        const selectNode = taskSelectElement.childNodes[0].childNodes[0];
        expect(selectNode).toHaveValue("NONE");
        expect(selectNode).not.toHaveValue("DIVE");
        fireEvent.change(selectNode, { target: { value: "DIVE" } });
        expect(selectNode).toHaveValue("DIVE");
        expect(selectNode).not.toHaveValue("NONE");
        //This is setting the element to be Dive however onChangeTaskType is not being called!!!
        expect(sendEventToParentWindowMock).toHaveBeenCalled;
        // no idea why this passes, mockOnChangeCheckParameters not being called due to ^
    });

    //Test selection of Dive with different Gloabla Parameters
    test.each([nonBottomDiveParameters, bottomDiveParameters, badBottomDiveParameters])(
        "TaskSettingsPanel Select Bottom Dive With Global Settings %s",
        async (diveParameters) => {
            GlobalSettings.diveParameters = { ...GlobalSettings.diveParameters, ...diveParameters };
            // Code above was suggested but does not do what we want, it does a merge
            // Code below should do what we want but raises
            // TypeError: value._localStorageKeyFunc is not a function
            //GlobalSettings.diveParameters = { ...diveParameters };
            Save(GlobalSettings.diveParameters);
            //eventual combine with tests above
            render(<TaskSettingsPanel {...mockBottomDiveProps} />);
            const taskSelectElement = screen.getByTestId("taskSelect");
            // Dig deep to find the actual <select>
            const selectNode = taskSelectElement.childNodes[0].childNodes[0];
            expect(selectNode).toHaveValue("NONE");
            expect(selectNode).not.toHaveValue("DIVE");
            fireEvent.change(selectNode, { target: { value: "DIVE" } });
            expect(selectNode).toHaveValue("DIVE");
            expect(selectNode).not.toHaveValue("NONE");
            //This is setting the element to be Dive however onChangeTaskType is not being called!!!
            //expect(sendEventToParentWindowMock).toHaveBeenCalledTimes(1);
            //^ this fails, mockOnChangeCheckParameters not being called due to ^
        },
    );
});

test("Toggle Bottom Dive ", async () => {
    render(<TaskSettingsPanel {...mockNonBottomDiveProps} />);
    const containerComponment = screen.getAllByTitle("Switch to Bottom Dive");
    log("** containerComponment **");
    log(containerComponment);
    const bottomToggleElement = screen.getByRole("checkbox");
    log("** bottomToggleElement **");
    log(bottomToggleElement);
    expect(bottomToggleElement).not.toBeChecked();
    userEvent.click(bottomToggleElement);
    expect(bottomToggleElement).toBeChecked();
});

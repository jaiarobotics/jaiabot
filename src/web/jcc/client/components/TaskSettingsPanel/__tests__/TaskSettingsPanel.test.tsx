import { render, screen, fireEvent, getByRole, waitFor} from "@testing-library/react";
//import UserEvent from "@testing-library/user-event";
import {TaskSettingsPanel, Props} from "../TaskSettingsPanel";
import { deepcopy} from "../../shared/Utilities";

import {
    MissionTask,
    TaskType,
    DiveParameters,
    DriftParameters,
    ConstantHeadingParameters,
    GeographicCoordinate,
    StationKeepParameters,
} from "../../shared/JAIAProtobuf";

import { log } from "console";
import { type } from "os";

const mockMinimumProps: Props = {
    enableEcho: false
}

//Mock of the onChange Prop to verify tasks are formatted correctly
const mockOnChangeCheckParameters = (task? : MissionTask) => {
    log("mockOnChangeCheckParameters checking task");
    log(task);
    switch (task.type) {
        case TaskType.CONSTANT_HEADING:
            //TODO
            break;
        case TaskType.DIVE:
             if(task.dive.bottom_dive) {
                //Bottom Dive = true, expect no other parameters
                expect (task.dive.max_depth).toBeUndefined();
                expect (task.dive.depth_interval).toBeUndefined();
                expect (task.dive.hold_time).toBeUndefined();
            }
            else {
                expect (task.dive.max_depth).toBeDefined;
                expect (task.dive.depth_interval).toBeDefined;
                expect (task.dive.hold_time).toBeDefined;
            
            }
            expect (task.surface_drift).toBeDefined;
            break;
        case TaskType.SURFACE_DRIFT:
            //TODO
            break;
        case TaskType.STATION_KEEP:
            //TODO
            break;
    }
};
const mockDriftParameters: DriftParameters = { //Mock Drift Parameters
    drift_time: 0
}
//Non-Bottom Dive Prop Setup
 const nonBottomDiveParameters: DiveParameters = { //Mock Non-Bottom Dive Parameters
    max_depth: 30,
    depth_interval :10,
    hold_time: 2,
    bottom_dive: false
}
const mockNonBottomDiveTask: MissionTask = { //Mock Non-Bottom Dive Task
    type: TaskType.DIVE,
    dive: nonBottomDiveParameters,
    surface_drift: mockDriftParameters  

}
const mockNonBottomDiveProps: Props = { //Mock Non-Bottom Dive Props
    task: mockNonBottomDiveTask,
    isEditMode: true,
    enableEcho: false,
    onChange: mockOnChangeCheckParameters
}
//Bottom Dive Prop Setup
const bottomDiveParameters: DiveParameters = { //Mock Bottom Dive Parameters
    bottom_dive: true
}
const mockBottomDiveTask: MissionTask = { //Mock Bottom Dive Task
    type: TaskType.DIVE,
    dive: bottomDiveParameters,
    surface_drift: mockDriftParameters  

}
const mockBottomDiveProps: Props = { //Mock Bottom Dive Props
    task: mockBottomDiveTask,
    isEditMode: true,
    enableEcho: false,
    onChange: mockOnChangeCheckParameters
}
//Bad Bottom Dive Prop Setup
const badBottomDiveParameters: DiveParameters = {//Mock ill-formed Bottom Dive Parameters
    max_depth: 30, //these 3 parameters should not be presetn for Bottom Dives
    depth_interval :10,
    hold_time: 2,
    bottom_dive: true
}
const mockBadBottomDiveTask: MissionTask = { //Mock Bottom Dive Task
    type: TaskType.DIVE,
    dive: badBottomDiveParameters,
    surface_drift: mockDriftParameters  

}
const mockBADBottomDiveProps: Props = { //Mock Bottom Dive Props
    task: mockBadBottomDiveTask,
    isEditMode: true,
    enableEcho: false,
    onChange: mockOnChangeCheckParameters
}

describe("TaskSettingsPanel Bottom Dive Tests", () => {
    //Test basic rendering of TaskSettingsPanel
    test("TaskSettingsPanel Renders", () => {
        render(<TaskSettingsPanel {...mockMinimumProps}/>);
        const taskElement = screen.getByRole("combobox")
        expect (taskElement).toHaveTextContent(/None/i)
    });
    //Test Selection of Dive with no tasks set
    test("TaskSettingsPanel Select Bottom Dive No Task", async () => {
        render(<TaskSettingsPanel {...mockMinimumProps} />);
        const taskSelectElement = screen.getByTestId("taskSelect")
        expect(taskSelectElement).toHaveTextContent(/None/i)
        //This approach relies on native={true} in the Select component
        //https://stackoverflow.com/questions/55184037/react-testing-library-on-change-for-material-ui-select-component

        // Dig deep to find the actual <select>
        const selectNode = taskSelectElement.childNodes[0].childNodes[0];
        fireEvent.change(selectNode, { target: { value: "DIVE" } });
        expect(taskSelectElement).toHaveTextContent(/Dive/i);
    });

    //Test Selection of Dive with an existing Bottom Dive Task
    test("TaskSettingsPanel Select Bottom Dive Bottom Dive Task", async () => {
        render(<TaskSettingsPanel {...mockBottomDiveProps} />);
        const taskSelectElement = screen.getByTestId("taskSelect")
        expect(taskSelectElement).toHaveTextContent(/None/i)
        //This approach relies on native={true} in the Select component
        //https://stackoverflow.com/questions/55184037/react-testing-library-on-change-for-material-ui-select-component

        // Dig deep to find the actual <select>
        const selectNode = taskSelectElement.childNodes[0].childNodes[0];
        fireEvent.change(selectNode, { target: { value: "DIVE" } });
        expect(taskSelectElement).toHaveTextContent(/Dive/i);
    });

    //Test Selection of Dive with a Bottom Dive Task including extra parameters
    test("TaskSettingsPanel Select Bottom Dive BadBottom Dive Task", async () => {
        render(<TaskSettingsPanel {...mockBADBottomDiveProps} />);
        const taskSelectElement = screen.getByTestId("taskSelect")
        expect(taskSelectElement).toHaveTextContent(/None/i)
        //This approach relies on native={true} in the Select component
        //https://stackoverflow.com/questions/55184037/react-testing-library-on-change-for-material-ui-select-component

        // Dig deep to find the actual <select>
        const selectNode = taskSelectElement.childNodes[0].childNodes[0];
        fireEvent.change(selectNode, { target: { value: "DIVE" } });
        expect(taskSelectElement).toHaveTextContent(/Dive/i);
    });


    /** 
    //This test should fail, just verifying mockOnChangeCheckParameters()
    test("TaskSettingsPanelBottomDivePreselected", async () => {
        render(<TaskSettingsPanel {...mockBADBottomDiveProps} />);
        const taskElement = screen.getByRole("combobox")
        expect(taskElement).toHaveTextContent("Dive")
        mockOnChangeCheckParameters(mockBADBottomDiveProps.task)
    });
    */
});


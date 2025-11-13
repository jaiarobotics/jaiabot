import { FormControl, Select, MenuItem, SelectChangeEvent, ThemeProvider } from "@mui/material";

import Icon from "@mdi/react";
import { mdiArrowRight } from "@mdi/js";

import { ChangeEvent, useContext, useState } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import TaskParameters from "../WaypointPanel/TaskParameters/TaskParameters";

import { gridLayer } from "../../openlayers/layers/vector/survey/grid-layer";
import Task from "../../data/tasks/task";
import { gridPlan, GridPlanDetails, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { formatNumericalInput, snakeCaseToTitleCase } from "../../utils/input";
import { selectTheme } from "../../utils/style";
import { TaskType } from "../../types/protobuf-types";

import "./SurveyPlanner.less";

interface Props {
    gridPlanDetails?: GridPlanDetails;
    handleSetTaskClick?: () => void;
    handleTaskSelection?: (evt: SelectChangeEvent, task: Task) => void;
    handleMenuNavClick?: (nextState: GridPlanningStates) => void;
    taskPosition?: TaskPosition;
}

enum GridInputs {
    NUM_OF_LANES = 1,
    LANE_SPACING = 2,
    POINT_SPACING = 3,
}

enum TaskPosition {
    START = 1,
    END = 2,
    SURVEY = 3,
}

/**
 * Renders the series of panels involved in developing a survey mission set
 */
export default function SurveyPlanner(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches the survey state change when the operator clicks
     * to add a task to the survey
     *
     * @returns {void}
     */
    const handleSetTaskClick = () => {
        // Wait for grid to be drawn
        if (!gridLayer.getCenterLine()) {
            return;
        }
        jaiaDispatch({
            type: JaiaActions.SURVEY_CHANGE_PLANNING_STATE,
            gridPlanningState: GridPlanningStates.ACCEPTING_TASK,
        });
    };

    /**
     * Changes the survey task based on the operator's selection
     *
     * @param {SelectChangeEvent} evt Contains which task is selected
     * @returns {void}
     */
    const handleTaskSelection = (evt: SelectChangeEvent, task: Task) => {
        jaiaDispatch({
            type: JaiaActions.SURVEY_SELECT_TASK,
            task: task,
            taskType: evt.target.value,
        });

        if (task === gridPlan.getSurveyTask()) {
            gridPlan.getSurveyTask().setType(evt.target.value as TaskType);
            gridLayer.finalizeGrid();
        } else if (task === gridPlan.getEndTask()) {
            gridPlan.getEndTask().setType(evt.target.value as TaskType);
            gridLayer.finalizeGrid();
        }
    };

    /**
     * Dispatches action to finalize survey planning
     *
     * @returns {void}
     */
    const handleMenuNavClick = (nextState: GridPlanningStates) => {
        if (nextState === GridPlanningStates.APPROVED) {
            jaiaDispatch({
                type: JaiaActions.SURVEY_APPROVED,
                gridPlanningState: nextState,
            });
        } else
            jaiaDispatch({
                type: JaiaActions.SURVEY_CHANGE_PLANNING_STATE,
                gridPlanningState: nextState,
            });
    };

    switch (jaiaContext.gridPlanDetails.state) {
        case GridPlanningStates.ACCEPTING_MISSION_START_LOCATION:
            return <RequestStartMissionLocation />;
        case GridPlanningStates.ACCEPTING_MISSION_END_LOCATION:
            return <RequestEndMissionLocation />;
        case GridPlanningStates.ACCEPTING_GRID_DRAWING:
            return (
                <GridConfigs
                    gridPlanDetails={props.gridPlanDetails}
                    handleSetTaskClick={handleSetTaskClick}
                />
            );
        case GridPlanningStates.ACCEPTING_TASK:
            return (
                <TaskConfigs
                    handleTaskSelection={handleTaskSelection}
                    handleMenuNavClick={() =>
                        handleMenuNavClick(GridPlanningStates.ACCEPTING_START_TASK)
                    }
                    taskPosition={TaskPosition.SURVEY}
                />
            );
        case GridPlanningStates.ACCEPTING_START_TASK:
            return (
                <TaskConfigs
                    handleTaskSelection={handleTaskSelection}
                    handleMenuNavClick={() =>
                        handleMenuNavClick(GridPlanningStates.ACCEPTING_END_TASK)
                    }
                    taskPosition={TaskPosition.START}
                />
            );
        case GridPlanningStates.ACCEPTING_END_TASK:
            return (
                <TaskConfigs
                    handleTaskSelection={handleTaskSelection}
                    handleMenuNavClick={() => handleMenuNavClick(GridPlanningStates.APPROVED)}
                    taskPosition={TaskPosition.END}
                />
            );
        case GridPlanningStates.APPROVED:
            return;
    }
}

/**
 * Renders the first panel in the series of building a grid-survey mission set
 */
function RequestStartMissionLocation() {
    return (
        <div className="jaia-panel survey">
            <div className="jaia-panel-title">Survey Planner</div>
            <div className="progress-line"></div>
            <div className="survey-location-page">Tap map for start location</div>
        </div>
    );
}

/**
 * Renders the second panel in the series of building a grid-survey mission set
 */
function RequestEndMissionLocation() {
    return (
        <div className="jaia-panel survey">
            <div className="jaia-panel-title">Survey Planner</div>
            <div className="progress-line"></div>
            <div className="survey-location-page">Tap map for end location</div>
        </div>
    );
}

/**
 * Renders the third panel in the series of building a grid-survey mission set
 */
function GridConfigs(props: Props) {
    const [numOfLanes, setNumOfLanes] = useState(props.gridPlanDetails.numOfLanes);
    const [pointSpacing, setPointSpacing] = useState(props.gridPlanDetails.pointSpacing);
    const [laneSpacing, setLaneSpacing] = useState(props.gridPlanDetails.laneSpacing);

    /**
     * Updates the grid planning parameters on the UI and in the data model
     *
     * @param {string} value The new value of the input field
     * @param {GridInputs} inputType Name of the input field changed
     * @returns {void}
     */
    const handleInputChange = (value: string, inputType: GridInputs) => {
        let input = Number(value);

        if (isNaN(input) || input < 0) {
            input = 0;
        }

        switch (inputType) {
            case GridInputs.NUM_OF_LANES:
                setNumOfLanes(input);
                gridPlan.setNumOfLanes(input);
                break;
            case GridInputs.LANE_SPACING:
                setLaneSpacing(input);
                gridPlan.setLaneSpacing(input);
                break;
            case GridInputs.POINT_SPACING:
                setPointSpacing(input);
                // Point spacing of 0 breaks turf along algorithm but is needed for input box
                // (i.e. it allows users to type multiples of ten)
                if (input === 0) {
                    input = 1;
                }
                gridPlan.setPointSpacing(input);
                break;
        }
        gridLayer.createGrid();
    };

    return (
        <div className="jaia-panel survey">
            <div className="jaia-panel-title">Survey Planner</div>
            <div className="progress-line"></div>
            <div className="survey-location-page">Drag to create the grid</div>
            <div className="input-grid">
                <div>Number of Lanes:</div>
                <input
                    type="number"
                    value={formatNumericalInput(numOfLanes)}
                    onChange={(evt: ChangeEvent<HTMLInputElement>) =>
                        handleInputChange(evt.target.value, GridInputs.NUM_OF_LANES)
                    }
                />
                <div>Lane Spacing:</div>
                <div className="input-group">
                    <input
                        type="number"
                        value={formatNumericalInput(laneSpacing)}
                        onChange={(evt: ChangeEvent<HTMLInputElement>) =>
                            handleInputChange(evt.target.value, GridInputs.LANE_SPACING)
                        }
                    />
                    <div className="units">m</div>
                </div>

                <div>Point Spacing:</div>
                <div className="input-group">
                    <input
                        type="number"
                        value={formatNumericalInput(pointSpacing)}
                        onChange={(evt: ChangeEvent<HTMLInputElement>) =>
                            handleInputChange(evt.target.value, GridInputs.POINT_SPACING)
                        }
                    />
                    <div className="units">m</div>
                </div>
            </div>
            <div className="button-row">
                <div onClick={() => props.handleSetTaskClick()}>
                    <Icon path={mdiArrowRight} title="Continue Survey Planning" />
                </div>
            </div>
        </div>
    );
}

/**
 * Renders the task setting windows in the series of building a grid-survey mission set
 */
function TaskConfigs(props: Props) {
    /**
     * Gets the task to to be modifed based on the task position
     *
     * @returns {Task} Task to be modified
     */
    const getTask = () => {
        switch (props.taskPosition) {
            case TaskPosition.START:
                return gridPlan.getStartTask();
            case TaskPosition.END:
                return gridPlan.getEndTask();
            case TaskPosition.SURVEY:
                return gridPlan.getSurveyTask();
        }
    };

    /**
     * Gets the label for the task selection menu
     *
     * @returns {string} Label for the task selection menu
     */
    const getTitle = () => {
        switch (props.taskPosition) {
            case TaskPosition.START:
                return "Start Task:";
            case TaskPosition.END:
                return "End Task:";
            case TaskPosition.SURVEY:
                return "Survey Task:";
        }
    };

    /**
     * Creates the list of task types for the dropdown menu
     *
     * @returns {MenuItem[]} List of task types
     */
    const getMenuItems = () => {
        const menuItems = [
            <MenuItem value={TaskType.NONE} key={TaskType.NONE}>
                {snakeCaseToTitleCase(TaskType.NONE)}
            </MenuItem>,
            <MenuItem value={TaskType.DIVE} key={TaskType.DIVE}>
                {snakeCaseToTitleCase(TaskType.DIVE)}
            </MenuItem>,
            <MenuItem value={TaskType.SURFACE_DRIFT} key={TaskType.SURFACE_DRIFT}>
                {snakeCaseToTitleCase(TaskType.SURFACE_DRIFT)}
            </MenuItem>,
        ];
        if (props.taskPosition !== TaskPosition.SURVEY) {
            menuItems.push(
                <MenuItem value={TaskType.CONSTANT_HEADING} key={TaskType.CONSTANT_HEADING}>
                    {snakeCaseToTitleCase(TaskType.CONSTANT_HEADING)}
                </MenuItem>,
            );
        }
        return menuItems;
    };

    /**
     * Returns the task parameters section when a task is selected
     *
     * @returns {React.Element} Task parameters section
     */
    const getTaskParametersContainer = () => {
        if (getTask().getType() === TaskType.NONE) {
            return;
        }

        return (
            <div className="task-parameters-container">
                <TaskParameters task={getTask()} isDisabled={false} />
            </div>
        );
    };

    return (
        <div className="jaia-panel survey">
            <div className="jaia-panel-title">Survey Planner</div>
            <div className="progress-line"></div>
            <div className="task-selection-container">
                <div>{getTitle()}</div>
                <ThemeProvider theme={selectTheme}>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select
                            value={getTask().getType()}
                            onChange={(evt: SelectChangeEvent) =>
                                props.handleTaskSelection(evt, getTask())
                            }
                        >
                            {getMenuItems()}
                        </Select>
                    </FormControl>
                </ThemeProvider>
            </div>
            {getTaskParametersContainer()}
            <div className="button-row">
                <div
                    onClick={() =>
                        props.handleMenuNavClick(GridPlanningStates.ACCEPTING_START_TASK)
                    }
                >
                    <Icon path={mdiArrowRight} title="Continue Survey Planning" />
                </div>
            </div>
        </div>
    );
}

import { FormControl, Select, MenuItem, SelectChangeEvent, ThemeProvider } from "@mui/material";
import { ChangeEvent, useContext, useState } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import TaskParameters from "../TaskParameters/TaskParameters";

import Task from "../../data/tasks/task";
import { gridLayer } from "../../openlayers/layers/vector/grid-layer";
import { gridPlan, GridPlanDetails, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { formatNumericalInput, formatTaskMenuItem } from "../../utils/input";
import { TaskType } from "../../types/protobuf-types";
import { selectTheme } from "../../utils/style";
import "./SurveyPlanner.less";

interface Props {
    gridPlanDetails?: GridPlanDetails;
    handleSetTaskClick?: () => void;
    handleTaskSelection?: (evt: SelectChangeEvent) => void;
    handleSaveSurveyTaskClick?: () => void;
}

enum GridInputs {
    NUM_OF_LANES = 1,
    LANE_SPACING = 2,
    POINT_SPACING = 3,
}

export default function SurveyPlanner(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    const handleSetTaskClick = () => {
        // Wait for grid to be drawn
        if (!gridLayer.getCenterLine()) {
            return;
        }
        gridPlan.setSurveyTask(new Task());
        jaiaDispatch({
            type: JaiaActions.SURVEY_CHANGE_PLANNING_STATE,
            gridPlanningState: GridPlanningStates.ACCEPTING_TASK,
        });
    };

    const handleTaskSelection = (evt: SelectChangeEvent) => {
        jaiaDispatch({
            type: JaiaActions.SURVEY_SELECT_TASK,
            task: gridPlan.getSurveyTask(),
            taskType: evt.target.value,
        });
        for (const [id, mission] of gridPlan.getMissions()) {
            const waypoints = mission.getWaypoints();
            for (const waypoint of waypoints) {
                waypoint.getTask().setType(evt.target.value as TaskType);
            }
        }
        gridLayer.finalizeGrid();
    };

    const handleSaveSurveyTaskClick = () => {
        jaiaDispatch({
            type: JaiaActions.SURVEY_CHANGE_PLANNING_STATE,
            gridPlanningState: GridPlanningStates.APPROVED,
        });
    };

    switch (jaiaContext.gridPlanningState) {
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
                    handleSaveSurveyTaskClick={handleSaveSurveyTaskClick}
                />
            );
        case GridPlanningStates.APPROVED:
            return;
    }
}

function RequestStartMissionLocation() {
    return (
        <div className="jaia-panel survey">
            <div className="jaia-panel-title">Survey Planner</div>
            <div className="progress-line"></div>
            <div className="survey-location-page">Set mission start on map</div>
        </div>
    );
}

function RequestEndMissionLocation() {
    return (
        <div className="jaia-panel survey">
            <div className="jaia-panel-title">Survey Planner</div>
            <div className="progress-line"></div>
            <div className="survey-location-page">Set mission end on map</div>
        </div>
    );
}

function GridConfigs(props: Props) {
    const [numOfLanes, setNumOfLanes] = useState(props.gridPlanDetails.numOfLanes);
    const [pointSpacing, setPointSpacing] = useState(props.gridPlanDetails.pointSpacing);
    const [laneSpacing, setLaneSpacing] = useState(props.gridPlanDetails.laneSpacing);

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
                <button onClick={() => props.handleSetTaskClick()}>Set Task</button>
            </div>
        </div>
    );
}

function TaskConfigs(props: Props) {
    return (
        <div className="jaia-panel survey">
            <div className="jaia-panel-title">Survey Planner</div>
            <div className="progress-line"></div>
            <div className="task-selection-container">
                <div>Survey Task:</div>
                <ThemeProvider theme={selectTheme}>
                    <FormControl sx={{ minWidth: 120 }} size="small">
                        <Select
                            value={gridPlan.getSurveyTask().getType()}
                            onChange={(evt: SelectChangeEvent) => props.handleTaskSelection(evt)}
                        >
                            <MenuItem value={TaskType.NONE}>
                                {formatTaskMenuItem(TaskType.NONE)}
                            </MenuItem>
                            <MenuItem value={TaskType.DIVE}>
                                {formatTaskMenuItem(TaskType.DIVE)}
                            </MenuItem>
                            <MenuItem value={TaskType.SURFACE_DRIFT}>
                                {formatTaskMenuItem(TaskType.SURFACE_DRIFT)}
                            </MenuItem>
                        </Select>
                    </FormControl>
                </ThemeProvider>
            </div>
            <div className="task-parameters-container">
                <TaskParameters task={gridPlan.getSurveyTask()} isDisabled={false} />
            </div>
            <div className="button-row">
                <button onClick={() => props.handleSaveSurveyTaskClick()}>Save</button>
            </div>
        </div>
    );
}

import { ChangeEvent, useContext, useState } from "react";
import { JaiaContext } from "../../context/JaiaContext";
import { gridLayer } from "../../openlayers/layers/vector/grid-layer";
import { gridPlan, GridPlanDetails, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { formatNumericalInput } from "../../utils/input";
import "./SurveyPlanner.less";

interface Props {
    gridPlanDetails: GridPlanDetails;
}

enum GridInputs {
    NUM_OF_LANES = 1,
    LANE_SPACING = 2,
    POINT_SPACING = 3,
}

export default function SurveyPlanner(props: Props) {
    const jaiaContext = useContext(JaiaContext);

    switch (jaiaContext.gridPlanningState) {
        case GridPlanningStates.ACCEPTING_MISSION_START_LOCATION:
            return <RequestStartMissionLocation />;
        case GridPlanningStates.ACCEPTING_MISSION_END_LOCATION:
            return <RequestEndMissionLocation />;
        case GridPlanningStates.ACCEPTING_GRID_DRAWING:
            return <GridConfigs gridPlanDetails={props.gridPlanDetails} />;
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

        if (isNaN(input) || input === 0) {
            input = 1;
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
                <button>Clear Grid</button>
                <button>Set Task</button>
            </div>
        </div>
    );
}

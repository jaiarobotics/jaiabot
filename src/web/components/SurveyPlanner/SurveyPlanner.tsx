import { useContext } from "react";
import { GridPlanDetails, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { JaiaContext } from "../../context/JaiaContext";

interface Props {
    gridPlanDetails: GridPlanDetails;
}

export default function SurveyPlanner(props: Props) {
    const jaiaContext = useContext(JaiaContext);

    switch (jaiaContext.gridPlanningState) {
        case GridPlanningStates.WAITING_FOR_MISSION_START_LOCATION:
            return <RequestStartMissionLocation />;
        case GridPlanningStates.WAITING_FOR_MISSION_END_LOCATION:
            return <RequestEndMissionLocation />;
        case GridPlanningStates.WAITING_FOR_GRID_DRAWING:
            return <GridConfigs />;
        case GridPlanningStates.WAITING_FOR_APPROVAL:
            return;
        case GridPlanningStates.APPROVED:
            return;
    }
}

function RequestStartMissionLocation() {
    return (
        <div className="jaia-panel">
            <div className="jaia-panel-title">Survey Planner</div>
            <div>
                <div>Select a mission start point on the map</div>
                <button>Use previous</button>
            </div>
        </div>
    );
}

function RequestEndMissionLocation() {
    return (
        <div className="jaia-panel">
            <div className="jaia-panel-title">Survey Planner</div>
            <div>
                <div>Select a mission end point on the map</div>
                <button>Use previous</button>
            </div>
        </div>
    );
}

function GridConfigs() {
    return (
        <div className="jaia-panel">
            <div className="jaia-panel-title">Survey Planner</div>
            <div>CONFIG</div>
        </div>
    );
}

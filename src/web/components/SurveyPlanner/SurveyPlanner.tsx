import { useContext } from "react";
import { GridPlanDetails, GridPlanningStates } from "../../data/survey_planner/grid-plan";
import { JaiaContext } from "../../context/JaiaContext";
import "./SurveyPlanner.less";

interface Props {
    gridPlanDetails: GridPlanDetails;
}

export default function SurveyPlanner(props: Props) {
    const jaiaContext = useContext(JaiaContext);

    switch (jaiaContext.gridPlanningState) {
        case GridPlanningStates.ACCEPTING_MISSION_START_LOCATION:
            return <RequestStartMissionLocation />;
        case GridPlanningStates.ACCEPTING_MISSION_END_LOCATION:
            return <RequestEndMissionLocation />;
        case GridPlanningStates.ACCEPTING_GRID_DRAWING:
            return <GridConfigs />;
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

function GridConfigs() {
    return (
        <div className="jaia-panel">
            <div className="jaia-panel-title">Survey Planner</div>
            <div>CONFIG</div>
        </div>
    );
}

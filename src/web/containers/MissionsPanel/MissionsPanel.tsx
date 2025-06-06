// React
import { useContext } from "react";

// Jaia
import MissionsList from "./MissionsList/MissionsList";
import DeleteMissionButton from "../../components/DeleteMissionButton/DeleteMissionButton";
import MissionSpeedSliders from "../../components/MissionSpeedSliders/MissionSpeedSliders";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

// MUI | MDI
import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiAutoFix, mdiContentSave, mdiDelete, mdiFolderOpen, mdiPlus } from "@mdi/js";

import "./MissionsPanel.less";

/**
 * Renders a panel for operators to manage missions
 */
export default function MissionsPanel() {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches the action to create a new mission when an operator clicks the add mission button
     *
     * @returns {void}
     */
    const handleAddMissionClick = () => {
        jaiaDispatch({ type: JaiaActions.ADD_MISSION });
    };

    /**
     * @notes
     * To be implemented
     */
    const handleLoadMissionsClick = () => {};

    /**
     * @notes
     * To be implemented
     */
    const handleSaveMissionsClick = () => {};

    /**
     * Dispatches the action to assign available Bots to open missions when an operator selects the magic wand button
     *
     * @returns {void}
     */
    const handleAutoAssignClick = () => {
        jaiaDispatch({ type: JaiaActions.AUTO_ASSIGN_MISSIONS });
    };

    return (
        <div className="jaia-panel missions-panel">
            <div className="jaia-panel-title">Mission Set</div>
            <MissionSpeedSliders />
            <div className="jaia-button-row">
                <Button
                    className="jaia-button"
                    aria-label="add-mission"
                    onClick={() => handleAddMissionClick()}
                >
                    <Icon path={mdiPlus} title="Add mission" />
                </Button>
                <DeleteMissionButton deleteAll={true} />
                <Button
                    className="jaia-button"
                    aria-label="load-missions"
                    onClick={() => handleLoadMissionsClick()}
                >
                    <Icon path={mdiFolderOpen} title="Load missions" />
                </Button>
                <Button
                    className="jaia-button"
                    aria-label="save-missions"
                    onClick={() => handleSaveMissionsClick()}
                >
                    <Icon path={mdiContentSave} title="Save missions" />
                </Button>
                <Button
                    className="jaia-button"
                    aria-label="auto-assign-bots"
                    onClick={() => handleAutoAssignClick()}
                >
                    <Icon path={mdiAutoFix} title="Auto assign Bots" />
                </Button>
            </div>
            <MissionsList />
        </div>
    );
}

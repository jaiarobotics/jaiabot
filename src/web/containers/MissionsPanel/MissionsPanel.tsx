// React
import { useContext } from "react";

// Jaia
import MissionSpeedSettings from "../MissionControllerPanel/MissionSpeedSettings/MissionSpeedSettings";
import MissionsList from "./MissionsList/MissionsList";
import { JaiaContext, JaiaDispatchContext } from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import { PanelNames } from "../../types/context-types";

// MUI | MDI
import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiAutoFix, mdiContentSave, mdiDelete, mdiFolderOpen, mdiPlus } from "@mdi/js";

import "./MissionsPanel.less";
import "../../style/stylesheets/util.less";

/**
 * Renders a panel for operators to manage missions
 */
export default function MissionsPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    if (jaiaContext === null || jaiaContext.visiblePanel !== PanelNames.MISSIONS) {
        return <div></div>;
    }

    /**
     * Dispatches the action to create a new mission when an operator clicks the add mission button
     *
     * @returns {void}
     */
    const handleAddMissionClick = () => {
        jaiaDispatch({ type: JaiaActions.ADD_MISSION });
    };

    /**
     * Dispatches the actions to clear all missions when an operator clicks the delete all missions button
     *
     * @returns {void}
     */
    const handleDeleteAllMissionsClick = () => {
        jaiaDispatch({ type: JaiaActions.DELETE_ALL_MISSIONS });
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
            <MissionSpeedSettings />
            <div className="jaia-button-row">
                <Button
                    className="jaia-button"
                    aria-label="add-mission"
                    onClick={() => handleAddMissionClick()}
                >
                    <Icon path={mdiPlus} title="Add mission" />
                </Button>
                <Button
                    className="jaia-button"
                    aria-label="delete-all-missions"
                    onClick={() => handleDeleteAllMissionsClick()}
                >
                    <Icon path={mdiDelete} title="Delete all missions" />
                </Button>
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

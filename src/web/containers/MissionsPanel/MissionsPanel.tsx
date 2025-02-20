// React
import { useContext } from "react";

// Jaia
import MissionSpeedSettings from "../MissionControllerPanel/MissionSpeedSettings/MissionSpeedSettings";
import MissionsList from "./MissionsList/MissionsList";
import { missions } from "../../data/missions/missions";
import { GlobalDispatchContext } from "../../context/Global/GlobalContext";
import { JaiaSystemDispatchContext } from "../../context/JaiaSystem/JaiaSystemContext";
import { GlobalActions } from "../../context/Global/GlobalActions";
import { JaiaSystemActions } from "../../context/JaiaSystem/jaia-system-actions";
import { NodeTypes } from "../../types/jaia-system-types";

// MUI | MDI
import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiAutoFix, mdiContentSave, mdiDelete, mdiFolderOpen, mdiPlus } from "@mdi/js";

import "./MissionsPanel.less";
import "../../style/stylesheets/util.less";

export default function MissionsPanel() {
    const globalDispatch = useContext(GlobalDispatchContext);
    const jaiaSystemDispatch = useContext(JaiaSystemDispatchContext);

    /**
     * Adds a mission to the system when an operator clicks the add mission button
     *  - Dispatches the action to create the new mission
     *  - Dispatches the action to set the new mission in edit mode
     *  - Dispatchces the action to open it's accordion
     *
     * @returns {void}
     */
    const handleAddMissionClick = () => {
        const newMissionID = missions.getNextMissionID();
        // Deselect node
        globalDispatch({
            type: GlobalActions.CLICKED_NODE,
            selectedNode: { type: NodeTypes.NONE, ID: -1 },
        });

        // Add the mission
        jaiaSystemDispatch({ type: JaiaSystemActions.ADD_MISSION });

        // Put mission in edit mode
        globalDispatch({
            type: GlobalActions.CLICKED_EDIT_MISSION,
            missionID: newMissionID,
        });

        // Opens the mission accordion
        globalDispatch({
            type: GlobalActions.CLICKED_MISSION_ACCORDION,
            missionID: newMissionID,
            isMissionAccordionExpanded: true,
        });

        // Prevents new missions from not being visible in the viewport
        autoScrollMissions();
    };

    /**
     * Prevents a newly created missions from not appearing in the viewport
     *
     * @returns {void}
     *
     * @notes
     * To be implemented
     */
    const autoScrollMissions = () => {};

    /**
     * Dispatches the actions to clear all missions when an operator clicks the delete all missions button
     *
     * @returns {void}
     */
    const handleDeleteAllMissionsClick = () => {
        jaiaSystemDispatch({ type: JaiaSystemActions.DELETE_ALL_MISSIONS });
        globalDispatch({ type: GlobalActions.RESET_MISSION_ACCORDIONS });
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
        jaiaSystemDispatch({ type: JaiaSystemActions.AUTO_ASSIGN_MISSIONS });
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

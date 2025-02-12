// React
import { useContext } from "react";

// Jaia
import MissionSpeedSettings from "../MissionControllerPanel/MissionSpeedSettings/MissionSpeedSettings";
import MissionsList from "./MissionsList/MissionsList";
import { GlobalDispatchContext } from "../../context/Global/GlobalContext";
import { JaiaSystemDispatchContext } from "../../context/JaiaSystem/JaiaSystemContext";
import { GlobalActions } from "../../context/Global/GlobalActions";
import { JaiaSystemActions } from "../../context/JaiaSystem/jaia-system-actions";

import { missions } from "../../data/missions/missions";
import { missionsManager } from "../../data/missions_manager/missions-manager";
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
     * Creates a new mission when an operator clicks the add mission button
     *
     * @returns {void}
     */
    const handleAddMissionClick = () => {
        // Deselect node
        globalDispatch({ type: GlobalActions.CLICKED_NODE, nodeType: NodeTypes.NONE, nodeID: -1 });

        jaiaSystemDispatch({ type: JaiaSystemActions.ADD_MISSION });

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
     * Clears all missions when an operator clicks the delete all missions button
     *
     * @returns {void}
     */
    const handleDeleteAllMissionsClick = () => {
        // Update data model
        missions.deleteAllMissions();
        missionsManager.clear();

        // Update OpenLayers

        // Update Context
        globalDispatch({ type: GlobalActions.CLICKED_DELETE_ALL_MISSIONS });
        jaiaSystemDispatch({ type: JaiaSystemActions.SYNC_REQUESTED });
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
     * Assigns available Bots to open missions when an operator selects the magic wand button
     *
     * @returns {void}
     */
    const handleAutoAssignClick = () => {
        // Update data model
        missionsManager.autoAssign();

        // Update JaiaSystemContext
        jaiaSystemDispatch({ type: JaiaSystemActions.SYNC_REQUESTED });
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

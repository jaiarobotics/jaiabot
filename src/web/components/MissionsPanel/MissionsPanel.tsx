// React
import { useContext } from "react";

// Jaia
import MissionsList from "./MissionsList/MissionsList";
import DeleteMissionButton from "../../components/__buttons__/DeleteMissionButton/DeleteMissionButton";
import MissionSpeedSliders from "./MissionSpeedSliders/MissionSpeedSliders";
import MissionSetStorageButton from "./MissionSetStorage/MissionSetStorageButton";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { MDI_BUTTON_SIZE } from "../../utils/constants";
import { scrollMissionsList } from "../../utils/style";

// MUI | MDI
import Button from "@mui/material/Button";
import Icon from "@mdi/react";
import { mdiAutoFix, mdiContentSave, mdiFolderOpen, mdiPlus } from "@mdi/js";

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
        scrollMissionsList();
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
                    <Icon path={mdiPlus} size={MDI_BUTTON_SIZE} title="Add mission" />
                </Button>
                <DeleteMissionButton deleteAll={true} />
                <MissionSetStorageButton />
                <Button
                    className="jaia-button"
                    aria-label="auto-assign-bots"
                    onClick={() => handleAutoAssignClick()}
                >
                    <Icon path={mdiAutoFix} size={MDI_BUTTON_SIZE} title="Auto assign Bots" />
                </Button>
            </div>
            <MissionsList />
        </div>
    );
}

import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import GoToRallyButton from "../__buttons__/GoToRallyButton/GoToRallyButton";

import Icon from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDelete } from "@mdi/js";

import "./RallyPanel.less";

/**
 * Renders a panel with two buttons providing the following functionality:
 * 1) Send Bots to a rally point
 * 2) Delete a rally point
 */
export default function RallyPanel() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches action to close rally panel
     *
     * @returns {void}
     */
    const handleClosePanelClick = () => {
        jaiaDispatch({ type: JaiaActions.CLOSED_RALLY_PANEL });
    };

    /**
     * Dispatches action to delete rally point
     *
     * @returns {void}
     */
    const handleDeleteRallyPoint = () => {
        jaiaDispatch({ type: JaiaActions.DELETE_RALLY_POINT });
    };

    const getSelectedRallyPoint = () => {
        return jaiaContext.rallyPoints.getRallyPoint(
            jaiaContext.rallyPoints.getSelectedRallyPointID(),
        );
    };

    return (
        <div className="jaia-panel">
            <div className="jaia-panel-title">
                Rally {jaiaContext.rallyPoints.getSelectedRallyPointID()}
            </div>
            <div className="rally-buttons-container">
                <GoToRallyButton
                    bots={jaiaContext.bots.getBots()}
                    rallyPoint={getSelectedRallyPoint()}
                    missionSpeeds={jaiaContext.missionSet.getMissionSpeeds()}
                />
                <Button className="jaia-button" onClick={() => handleDeleteRallyPoint()}>
                    <Icon path={mdiDelete} />
                </Button>
            </div>
            <div className="close-button-container">
                <button onClick={() => handleClosePanelClick()}>Close</button>
            </div>
        </div>
    );
}

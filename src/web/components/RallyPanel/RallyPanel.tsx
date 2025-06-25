import { useContext } from "react";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import Icon from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDelete, mdiPlay } from "@mdi/js";

import "./RallyPanel.less";

/**
 * Renders a panel with two buttons providing the following functionality:
 * 1) Send Bots to a rally point
 * 2) Delete a rally point
 */
export default function RallyPanel() {
    const jaiaDispatch = useContext(JaiaDispatchContext);

    /**
     * Dispatches action to close rally panel
     *
     * @returns {void}
     */
    const handleClosePanelClick = () => {
        jaiaDispatch({ type: JaiaActions.CLOSED_RALLY_PANEL });
    };

    return (
        <div className="jaia-panel">
            <div className="jaia-panel-title">Rally 1</div>
            <div className="rally-buttons-container">
                <Button className="jaia-button">
                    <Icon path={mdiPlay} />
                </Button>
                <Button className="jaia-button">
                    <Icon path={mdiDelete} />
                </Button>
            </div>
            <div className="close-button-container">
                <button onClick={() => handleClosePanelClick()}>Close</button>
            </div>
        </div>
    );
}

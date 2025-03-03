import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../context/Jaia/jaia-actions";
import { PanelNames } from "../../types/context-types";

import Icon from "@mdi/react";
import { Button } from "@mui/material";
import { mdiViewList } from "@mdi/js";

/**
 * Displays the buttons on the right side of the JCC
 */
export default function SideButtonList() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDisaptch = useContext(JaiaDispatchContext);

    if (jaiaContext === null) {
        return <div></div>;
    }

    /**
     * Dispatches action to open/close panel associated with button
     *
     * @param {PanelNames} panelName Name of panel associated with button
     * @returns {void}
     */
    const handlePanelButtonClick = (panelName: PanelNames) => {
        jaiaDisaptch({ type: JaiaActions.CLICKED_PANEL_BUTTON, panelName: panelName });
    };

    /**
     * Provides the class name to style the button based on its selection state
     *
     * @param {PanelNames} panelName Name of panel associated with button
     * @returns {void}
     */
    const getSelectedClassName = (panelName: PanelNames) => {
        if (jaiaContext.visiblePanel === panelName) {
            return "selected";
        }
        return "";
    };

    return (
        <div className="button-list side">
            <Button
                className={`jaia-button ${getSelectedClassName(PanelNames.MISSIONS)}`}
                aria-label="missions-panel"
                onClick={() => handlePanelButtonClick(PanelNames.MISSIONS)}
            >
                <Icon path={mdiViewList} title="Missions Panel" />
            </Button>

            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
            <Button className="jaia-button"></Button>
        </div>
    );
}

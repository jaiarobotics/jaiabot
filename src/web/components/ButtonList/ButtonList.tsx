import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import ActivateAllButton from "../ActivateAllButton/ActivateAllButton";

import { PanelNames } from "../../types/context-types";
import { ButtonListTypes } from "../../types/jaia-system-types";

import Icon from "@mdi/react";
import { Button } from "@mui/material";
import { mdiViewList } from "@mdi/js";

interface Props {
    buttonListType: ButtonListTypes;
}

/**
 * Displays the buttons on the top and right side of the JCC
 */
export default function ButtonList(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDisaptch = useContext(JaiaDispatchContext);

    if (jaiaContext === null || jaiaDisaptch === null) {
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

    if (props.buttonListType === ButtonListTypes.TOP) {
        return (
            <div className="button-list top">
                <ActivateAllButton bots={jaiaContext.bots} />
                <Button className="jaia-button"></Button>
                <Button className="jaia-button"></Button>
                <Button className="jaia-button"></Button>
                <Button className="jaia-button"></Button>
                <Button className="jaia-button"></Button>
                <Button
                    className={`jaia-button ${getSelectedClassName(PanelNames.JAIA_ABOUT)}`}
                    aria-label="jaia-about-panel"
                    onClick={() => handlePanelButtonClick(PanelNames.JAIA_ABOUT)}
                ></Button>
            </div>
        );
    }

    if (props.buttonListType === ButtonListTypes.SIDE) {
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
            </div>
        );
    }
}

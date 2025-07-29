import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

import RallyButton from "../RallyButton/RallyButton";
import ActivateAllButton from "../ActivateAllButton/ActivateAllButton";
import StopAllBotsButton from "../StopAllBots/StopAllBotsButton";
import DataOffloadAllButton from "../DataOfffloadAllButton/DataOffloadAllButton";
import StartAllMissionsButton from "../StartAllMissionsButton/StartAllMissionsButton";

import { ButtonNames, ButtonTypes } from "../../types/context-types";
import { ButtonListTypes } from "../../types/jaia-system-types";

import Icon from "@mdi/react";
import { Button } from "@mui/material";
import { mdiHelp, mdiProgressDownload, mdiViewList } from "@mdi/js";

import JaiaLogo from "../../style/icons/jaia-logo.svg";

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
     * @param {ButtonTypes} buttonType Type of button clicked
     * @param {ButtonNames} buttonName Name of button clicked
     * @returns {void}
     */
    const handleButtonClick = (buttonType: ButtonTypes, buttonName: ButtonNames) => {
        jaiaDisaptch({
            type: JaiaActions.CLICKED_BUTTON,
            buttonType: buttonType,
            buttonName: buttonName,
        });
    };

    /**
     * Provides the class name to style the button based on its selection state
     *
     * @param {ButtonNames} buttonName Name of button clicked
     * @returns {void}
     */
    const getSelectedClassName = (buttonName: ButtonNames) => {
        if (jaiaContext.visiblePanel === buttonName) {
            return " jaia-button selected";
        }
        return "jaia-button";
    };

    if (props.buttonListType === ButtonListTypes.TOP) {
        return (
            <div className="button-list top">
                <ActivateAllButton bots={jaiaContext.bots} />
                <StopAllBotsButton bots={jaiaContext.bots} />
                <StartAllMissionsButton bots={jaiaContext.bots} missions={jaiaContext.missions} />
                <DataOffloadAllButton bots={jaiaContext.bots} />
                <Button className="jaia-button"></Button>
                <Button
                    className={getSelectedClassName(ButtonNames.HELP_PANEL)}
                    aria-label="help-window"
                    onClick={() => handleButtonClick(ButtonTypes.PANEL, ButtonNames.HELP_PANEL)}
                >
                    <Icon path={mdiHelp} />
                </Button>
                <Button
                    className={getSelectedClassName(ButtonNames.JAIA_ABOUT_PANEL)}
                    aria-label="jaia-about-panel"
                    onClick={() =>
                        handleButtonClick(ButtonTypes.PANEL, ButtonNames.JAIA_ABOUT_PANEL)
                    }
                >
                    <img src={JaiaLogo} title="About" />
                </Button>
            </div>
        );
    }

    if (props.buttonListType === ButtonListTypes.SIDE) {
        return (
            <div className="button-list side">
                <Button
                    className={getSelectedClassName(ButtonNames.MISSIONS_PANEL)}
                    aria-label="missions-panel"
                    onClick={() => handleButtonClick(ButtonTypes.PANEL, ButtonNames.MISSIONS_PANEL)}
                >
                    <Icon path={mdiViewList} title="Missions Panel" />
                </Button>
                <RallyButton />
                <Button
                    className={getSelectedClassName(ButtonNames.DATA_OFFLOAD_PANEL)}
                    aria-label="data-offload-panel"
                    onClick={() =>
                        handleButtonClick(ButtonTypes.PANEL, ButtonNames.DATA_OFFLOAD_PANEL)
                    }
                >
                    <Icon path={mdiProgressDownload} title="Data Offload Panel" />
                </Button>
                <Button className="jaia-button"></Button>
                <Button className="jaia-button"></Button>
            </div>
        );
    }
}

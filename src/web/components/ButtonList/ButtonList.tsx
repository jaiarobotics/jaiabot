import { useContext } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";
import { historyManager } from "../../data/history/histroy-manager";

import RallyButton from "../__buttons__/RallyButton/RallyButton";
import ActivateAllButton from "../__buttons__/ActivateAllButton/ActivateAllButton";
import StopAllBotsButton from "../__buttons__/StopAllBotsButton/StopAllBotsButton";
import DataOffloadAllButton from "../__buttons__/DataOfffloadAllButton/DataOffloadAllButton";
import StartAllMissionsButton from "../__buttons__/StartAllMissionsButton/StartAllMissionsButton";

import { ButtonNames, ButtonTypes } from "../../types/context-types";
import { ButtonListTypes } from "../../types/jaia-system-types";
import { MDI_BUTTON_SIZE } from "../../utils/constants";

import Icon from "@mdi/react";
import { Button } from "@mui/material";
import {
    mdiCog,
    mdiHelp,
    mdiProgressDownload,
    mdiRuler,
    mdiVectorPolygon,
    mdiViewList,
    mdiArrowULeftTop,
    mdiSquareEditOutline,
} from "@mdi/js";

import JaiaOnlyLogo from "../../style/icons/jaia-only-logo.png";
import "./ButtonList.less";

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
     * Dispatches action to undo history
     *
     * @returns {void}
     */
    const handleUndoClick = () => {
        jaiaDisaptch({ type: JaiaActions.CLICKED_UNDO });
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

    /**
     * Provides the class name to style the undo button
     *
     * @returns {void}
     */
    const getUndoClassName = () =>
        historyManager.canUndo() ? "jaia-button" : "jaia-button disabled";

    if (props.buttonListType === ButtonListTypes.TOP) {
        return (
            <div className="button-list top">
                <ActivateAllButton bots={jaiaContext.bots.getBots()} />
                <StopAllBotsButton bots={jaiaContext.bots.getBots()} />
                <StartAllMissionsButton
                    bots={jaiaContext.bots.getBots()}
                    missions={jaiaContext.missionSet.getMissions()}
                    missionSetName={jaiaContext.missionSet.getName()}
                />
                <DataOffloadAllButton bots={jaiaContext.bots.getBots()} />
                <Button
                    className={getUndoClassName()}
                    disabled={!historyManager.canUndo()}
                    onClick={() => handleUndoClick()}
                >
                    <Icon path={mdiArrowULeftTop} title={"Undo "} />
                </Button>
                <Button
                    className={getSelectedClassName(ButtonNames.HELP_PANEL)}
                    aria-label="help-window"
                    onClick={() => handleButtonClick(ButtonTypes.PANEL, ButtonNames.HELP_PANEL)}
                >
                    <Icon path={mdiHelp} size={MDI_BUTTON_SIZE} />
                </Button>
                <Button
                    className={getSelectedClassName(ButtonNames.JAIA_ABOUT_PANEL)}
                    id="jaia-about"
                    aria-label="jaia-about-panel"
                    onClick={() =>
                        handleButtonClick(ButtonTypes.PANEL, ButtonNames.JAIA_ABOUT_PANEL)
                    }
                >
                    <img src={JaiaOnlyLogo} title="About" />
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
                    <Icon path={mdiViewList} size={MDI_BUTTON_SIZE} title="Missions Panel" />
                </Button>
                <Button
                    className={getSelectedClassName(ButtonNames.SURVEY_TOOL)}
                    aria-label="survey-tool"
                    onClick={() => handleButtonClick(ButtonTypes.MAP_MODE, ButtonNames.SURVEY_TOOL)}
                >
                    <Icon path={mdiSquareEditOutline} size={MDI_BUTTON_SIZE} title="Survey Tool" />
                </Button>
                {/* <Button
                    className={getSelectedClassName(ButtonNames.EXCLUSION_ZONES_PANEL)}
                    aria-label="exclusion-zones-panel"
                    onClick={() =>
                        handleButtonClick(ButtonTypes.PANEL, ButtonNames.EXCLUSION_ZONES_PANEL)
                    }
                >
                    <Icon
                        path={mdiVectorPolygon}
                        size={MDI_BUTTON_SIZE}
                        title="Obstacle Zones Panel"
                    />
                </Button> */}
                <RallyButton />
                <Button
                    className={getSelectedClassName(ButtonNames.DATA_OFFLOAD_PANEL)}
                    aria-label="data-offload-panel"
                    onClick={() =>
                        handleButtonClick(ButtonTypes.PANEL, ButtonNames.DATA_OFFLOAD_PANEL)
                    }
                >
                    <Icon
                        path={mdiProgressDownload}
                        size={MDI_BUTTON_SIZE}
                        title="Data Offload Panel"
                    />
                </Button>
                <Button
                    className={getSelectedClassName(ButtonNames.MEASURE_TOOL)}
                    aria-label="measure-tool"
                    onClick={() =>
                        handleButtonClick(ButtonTypes.MAP_MODE, ButtonNames.MEASURE_TOOL)
                    }
                >
                    <Icon path={mdiRuler} size={MDI_BUTTON_SIZE} title="Measure Tool"></Icon>
                </Button>
                <Button
                    className={getSelectedClassName(ButtonNames.SETTINGS_PANEL)}
                    aria-label="settings-panel"
                    onClick={() => handleButtonClick(ButtonTypes.PANEL, ButtonNames.SETTINGS_PANEL)}
                >
                    <Icon path={mdiCog} size={MDI_BUTTON_SIZE} title="Settings Panel" />
                </Button>
            </div>
        );
    }
}

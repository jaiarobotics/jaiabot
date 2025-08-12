// React
import { useContext, useEffect } from "react";

// Jaia
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import MissionAssignMenu from "../../../components/MissionAssignMenu/MissionAssignMenu";
import DeleteMissionButton from "../../../components/DeleteMissionButton/DeleteMissionButton";

import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { MDI_BUTTON_SIZE, UNASSIGNED_ID } from "../../../utils/constants";
import { accordionTheme, addDropdownListener, scrollMissionsList } from "../../../utils/style";
import JaiaToggle from "../../../components/JaiaToggle/JaiaToggle";

// MUI | MDI
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Icon from "@mdi/react";
import { mdiContentDuplicate } from "@mdi/js";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    ThemeProvider,
} from "@mui/material";

import "./MissionsList.less";

interface MissionAccordionTitleProps {
    missionID: number;
}

export default function MissionsList() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    useEffect(() => {
        addDropdownListener("mission-accordion", "missions-list");
    });

    /**
     * Triggered when the expand/collapse state is changed on the Accordion component
     *
     * @param {number} missionID Signals which mission accordion the operator clicked
     * @param  {boolean} isExpanded Expanded state of the accordion after the click
     * @returns {void}
     */
    const handleAccordionChange = (missionID: number, isExpanded: boolean) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_MISSION_ACCORDION,
            missionID: missionID,
            isMissionAccordionExpanded: isExpanded,
        });
    };

    /**
     * Provides the expand/collapse state of the mission accordion when the component renders
     *
     * @param {number} missionID Determines which mission accordion state to check
     * @returns {void}
     */
    const isMissionAccordionExpanded = (missionID: number) => {
        if (missionID in jaiaContext.missionAccordionStates) {
            return jaiaContext.missionAccordionStates[missionID];
        }
        return false;
    };

    /**
     * Triggered when the operator clicks the duplicate mission button
     *
     * @param {number} missionID ID of the mission to be duplicated
     * @returns {void}
     *
     * @notes
     * To be implemented in a separate ticket
     */
    const handleDuplicateMissionClick = (missionID: number) => {
        jaiaDispatch({
            type: JaiaActions.DUPLICATE_MISSION,
            missionID: missionID,
        });
        scrollMissionsList();
    };

    /**
     * Triggered when the operator clicks the edit mission toggle
     *
     * @param {number} missionID ID of the mission toggled
     * @returns {void}
     */
    const handleToggleEditClick = (missionID: number) => {
        jaiaDispatch({
            type: JaiaActions.CLICKED_EDIT_MISSION,
            missionID: missionID,
        });
    };

    return (
        <div id="missions-list" data-testid="missions-list">
            {Array.from(jaiaContext.missions.values()).map((mission) => {
                return (
                    <ThemeProvider theme={accordionTheme} key={mission.getMissionID()}>
                        <Accordion
                            className="mission-accordion"
                            expanded={isMissionAccordionExpanded(mission.getMissionID())}
                            onChange={(event, expanded) =>
                                handleAccordionChange(mission.getMissionID(), expanded)
                            }
                        >
                            <AccordionSummary
                                className="mission-accordion-summary"
                                expandIcon={<ExpandMoreIcon />}
                            >
                                <MissionAccordionTitle missionID={mission.getMissionID()} />
                            </AccordionSummary>
                            <AccordionDetails className="mission-accordion-details">
                                <MissionAssignMenu missionID={mission.getMissionID()} />
                                <Button
                                    className="jaia-button"
                                    aria-label="duplicate-mission"
                                    data-testid={`duplicate-mission-${mission.getMissionID()}`}
                                    onClick={() =>
                                        handleDuplicateMissionClick(mission.getMissionID())
                                    }
                                >
                                    <Icon
                                        path={mdiContentDuplicate}
                                        size={MDI_BUTTON_SIZE}
                                        title="Duplicate Mission"
                                    />
                                </Button>
                                <DeleteMissionButton
                                    deleteAll={false}
                                    missionID={mission.getMissionID()}
                                />
                                <JaiaToggle
                                    checked={() =>
                                        jaiaContext.missionIDInEditMode === mission.getMissionID()
                                    }
                                    onClick={() => handleToggleEditClick(mission.getMissionID())}
                                    label="Edit"
                                    title="ToggleEditMode"
                                    testLabel={`Edit Mission ${mission.getMissionID()}`}
                                />
                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>
                );
            })}
        </div>
    );
}

function MissionAccordionTitle(props: MissionAccordionTitleProps) {
    const assignedBotID = missionsManager.getBotID(props.missionID) ?? -1;
    return (
        <div className="mission-accordion-title">
            <p>{`Mission-${props.missionID}`}</p>
            <p className="mission-assignment">
                {assignedBotID === UNASSIGNED_ID ? "Unassigned" : `Bot-${assignedBotID}`}
            </p>
        </div>
    );
}

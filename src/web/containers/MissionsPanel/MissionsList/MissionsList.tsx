// React
import { useContext } from "react";

// Jaia
import { JaiaContext, JaiaDispatchContext } from "../../../context/Jaia/JaiaContext";
import { JaiaActions } from "../../../context/Jaia/jaia-actions";
import MissionAssignMenu from "../../../components/MissionAssignMenu/MissionAssignMenu";

import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { UNASSIGNED_ID } from "../../../utils/constants";
import JaiaToggle from "../../../components/JaiaToggle/JaiaToggle";

// MUI | MDI
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Icon from "@mdi/react";
import { mdiContentDuplicate, mdiDelete } from "@mdi/js";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    ThemeProvider,
    createTheme,
} from "@mui/material";

import "./MissionsList.less";

interface MissionAccordionTitleProps {
    missionID: number;
}

// Disable animations from MUI accordions because of lag experienced by operators
const accordionTheme = createTheme({ transitions: { create: () => "none" } });

export default function MissionsList() {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);

    if (!jaiaContext) {
        return <div></div>;
    }

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
    const handleDuplicateMissionClick = (missionID: number) => {};

    /**
     * Triggered when the operator clicks the delete mission button
     *
     * @param {number} missionID ID of the mission to be deleted
     * @returns {void}
     */
    const handleDeleteMissionClick = (missionID: number) => {
        jaiaDispatch({
            type: JaiaActions.DELETE_MISSION,
            missionID: missionID,
        });
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
        <div className="missions-list" data-testid="missions-list">
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
                                    onClick={() =>
                                        handleDuplicateMissionClick(mission.getMissionID())
                                    }
                                >
                                    <Icon path={mdiContentDuplicate} />
                                </Button>
                                <Button
                                    className="jaia-button"
                                    aria-label="delete-mission"
                                    onClick={() => handleDeleteMissionClick(mission.getMissionID())}
                                >
                                    <Icon path={mdiDelete} />
                                </Button>
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

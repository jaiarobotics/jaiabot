// React
import { useContext } from "react";

// Jaia
import { GlobalContext, GlobalDispatchContext } from "../../../context/Global/GlobalContext";
import {
    JaiaSystemContext,
    JaiaSystemDispatchContext,
} from "../../../context/JaiaSystem/JaiaSystemContext";
import { GlobalActions } from "../../../context/Global/GlobalActions";
import { JaiaSystemActions } from "../../../context/JaiaSystem/jaia-system-actions";
import MissionAssignMenu from "../../../components/MissionAssignMenu/MissionAssignMenu";

import { missions } from "../../../data/missions/missions";
import { jaiaGlobal } from "../../../data/jaia_global/jaia-global";
import { missionsManager } from "../../../data/missions_manager/missions-manager";

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

const UNASSIGNED_ID = -1;

// Disable animations from MUI accordions because of lag experienced by operators
const accordionTheme = createTheme({ transitions: { create: () => "none" } });

export default function MissionsList() {
    const globalContext = useContext(GlobalContext);
    const globalDispatch = useContext(GlobalDispatchContext);
    const jaiaSystemContext = useContext(JaiaSystemContext);
    const jaiaSystemDispatch = useContext(JaiaSystemDispatchContext);

    if (!globalContext || !jaiaSystemContext) {
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
        globalDispatch({
            type: GlobalActions.CLICKED_MISSION_ACCORDION,
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
        if (missionID in globalContext.missionAccordionStates) {
            return globalContext.missionAccordionStates[missionID];
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
        jaiaSystemDispatch({ type: JaiaSystemActions.DELETE_MISSION, missionID: missionID });
    };

    return (
        <div className="missions-list" data-testid="missions-list">
            {Array.from(jaiaSystemContext.missions.values()).map((mission) => {
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

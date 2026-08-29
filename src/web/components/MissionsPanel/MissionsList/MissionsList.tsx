// React
import { useContext, useEffect } from "react";

// Jaia
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import MissionAssignMenu from "../MissionAssignMenu/MissionAssignMenu";
import DeleteMissionButton from "../../../components/__buttons__/DeleteMissionButton/DeleteMissionButton";

import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { MDI_BUTTON_SIZE, UNASSIGNED_ID } from "../../../utils/constants";
import { accordionTheme, addDropdownListener, scrollMissionsList } from "../../../utils/style";
import JaiaToggle from "../../../components/JaiaToggle/JaiaToggle";
import { StepperButtons } from "../../../components/JaiaNumberInput/JaiaNumberInput";

// MUI | MDI
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Icon from "@mdi/react";
import { mdiContentDuplicate } from "@mdi/js";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Button,
    TextField,
    ThemeProvider,
} from "@mui/material";

import "./MissionsList.less";

interface Props {
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
     * Dispatches action to update the number of repeats for a mission
     *
     * @param {string} repeats Desired number of mission repeats
     * @param {number} missionID Identifies which mission to update
     * @returns {void}
     */
    const handleRepeatsChange = (repeats: string, missionID: number) => {
        let numOfRepeats = Number(repeats);
        if (repeats === "" || isNaN(numOfRepeats) || numOfRepeats < 1) {
            numOfRepeats = 1;
        }
        jaiaDispatch({
            type: JaiaActions.CHANGE_MISSION_REPEATS,
            missionRepeats: numOfRepeats,
            missionID: missionID,
        });
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
            {Array.from(jaiaContext.missionSet.getMissions().values()).map((mission) => {
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
                                <div className="mission-accordion-row">
                                    <MissionAssignMenu missionID={mission.getMissionID()} />
                                    <TextField
                                        label="Repeats"
                                        size="small"
                                        type="number"
                                        slotProps={{
                                            htmlInput: { min: 1 },
                                            input: {
                                                endAdornment: (
                                                    <StepperButtons
                                                        onStep={(direction) =>
                                                            handleRepeatsChange(
                                                                String(
                                                                    Number(mission.getRepeats()) +
                                                                        direction,
                                                                ),
                                                                mission.getMissionID(),
                                                            )
                                                        }
                                                    />
                                                ),
                                            },
                                        }}
                                        className="mission-repeats"
                                        autoComplete="off"
                                        value={mission.getRepeats()}
                                        onChange={(event) =>
                                            handleRepeatsChange(
                                                event.target.value,
                                                mission.getMissionID(),
                                            )
                                        }
                                    />
                                </div>
                                <div className="mission-accordion-row">
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
                                            jaiaContext.missionSet.getMissionIDInEditMode() ===
                                            mission.getMissionID()
                                        }
                                        onClick={() =>
                                            handleToggleEditClick(mission.getMissionID())
                                        }
                                        label="Edit"
                                        title="ToggleEditMode"
                                        testLabel={`Edit Mission ${mission.getMissionID()}`}
                                    />
                                </div>
                            </AccordionDetails>
                        </Accordion>
                    </ThemeProvider>
                );
            })}
        </div>
    );
}

function MissionAccordionTitle(props: Props) {
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

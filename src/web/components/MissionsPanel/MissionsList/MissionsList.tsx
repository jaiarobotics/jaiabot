// React
import { useContext, useEffect, useState } from "react";

// Jaia
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import MissionAssignMenu from "../MissionAssignMenu/MissionAssignMenu";
import DeleteMissionButton from "../../../components/__buttons__/DeleteMissionButton/DeleteMissionButton";

import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { MDI_BUTTON_SIZE, MIN_BATTERY_PERCENT, UNASSIGNED_ID } from "../../../utils/constants";
import { fetchBatteryPrediction } from "../../../utils/battery_prediction";
import { accordionTheme, addDropdownListener, scrollMissionsList } from "../../../utils/style";
import JaiaToggle from "../../../components/JaiaToggle/JaiaToggle";
import { DisabledCodes } from "../../__buttons__/disabled-codes";

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
     * @param {boolean} isExpanded Expanded state of the accordion after the click
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
     * @returns {boolean} True if the accordion is expanded
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
        if (isNaN(numOfRepeats)) {
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
            {Array.from(jaiaContext.missionSet.getMissions().values()).map((mission) => (
                <MissionAccordion
                    key={mission.getMissionID()}
                    missionID={mission.getMissionID()}
                    isExpanded={isMissionAccordionExpanded(mission.getMissionID())}
                    onAccordionChange={handleAccordionChange}
                    onRepeatsChange={handleRepeatsChange}
                    onDuplicateClick={handleDuplicateMissionClick}
                    onToggleEditClick={handleToggleEditClick}
                    isInEditMode={
                        jaiaContext.missionSet.getMissionIDInEditMode() === mission.getMissionID()
                    }
                    repeats={mission.getRepeats()}
                    missionKey={JSON.stringify(mission)}
                />
            ))}
        </div>
    );
}

interface MissionAccordionProps {
    missionID: number;
    isExpanded: boolean;
    isInEditMode: boolean;
    repeats: number;
    missionKey: string;
    onAccordionChange: (missionID: number, isExpanded: boolean) => void;
    onRepeatsChange: (repeats: string, missionID: number) => void;
    onDuplicateClick: (missionID: number) => void;
    onToggleEditClick: (missionID: number) => void;
}

/**
 * Renders a single mission accordion with a color-coded title bar indicating mission health.
 * Grey when no bot is assigned, green when assigned with no issues, red when assigned with an issue.
 * Fetches a battery drain prediction debounced 500ms after any mission change.
 *
 * @param {number} props.missionID ID of the mission to render
 * @param {boolean} props.isExpanded Whether the accordion is currently expanded
 * @param {boolean} props.isInEditMode Whether this mission is currently in edit mode
 * @param {number} props.repeats Number of times the mission repeats
 * @param {string} props.missionKey Serialized mission used to detect changes for prediction refetch
 * @param {Function} props.onAccordionChange Called when the accordion is expanded or collapsed
 * @param {Function} props.onRepeatsChange Called when the repeats value is changed
 * @param {Function} props.onDuplicateClick Called when the duplicate button is clicked
 * @param {Function} props.onToggleEditClick Called when the edit toggle is clicked
 * @returns {JSX.Element} The mission accordion
 */
function MissionAccordion(props: MissionAccordionProps) {
    const jaiaContext = useContext(JaiaContext);
    const [disabledCode, setDisabledCode] = useState<DisabledCodes>(DisabledCodes.NONE);

    const assignedBotID = missionsManager.getBotID(props.missionID) ?? UNASSIGNED_ID;
    const mission = jaiaContext.missionSet.getMissions().get(props.missionID);
    const bot = assignedBotID !== UNASSIGNED_ID ? jaiaContext.bots.getBot(assignedBotID) : null;

    useEffect(() => {
        if (!bot) {
            setDisabledCode(DisabledCodes.NO_MISSION);
            return;
        }

        if (bot.getBatteryPercent() < MIN_BATTERY_PERCENT) {
            setDisabledCode(DisabledCodes.LOW_BATTERY);
            return;
        }

        const timer = setTimeout(async () => {
            const prediction = mission ? await fetchBatteryPrediction(mission, bot) : null;
            setDisabledCode(
                prediction !== null && prediction.predicted_final_pct < MIN_BATTERY_PERCENT
                    ? DisabledCodes.INSUFFICIENT_BATTERY
                    : DisabledCodes.NONE,
            );
        }, 500);

        return () => clearTimeout(timer);
    }, [props.missionKey, assignedBotID]);

    const getSummaryClass = () => {
        if (disabledCode === DisabledCodes.NO_MISSION) {
            return "mission-accordion-summary mission-accordion-summary--unassigned";
        }
        if (disabledCode !== DisabledCodes.NONE) {
            return "mission-accordion-summary mission-accordion-summary--warning";
        }
        return "mission-accordion-summary mission-accordion-summary--good";
    };

    return (
        <ThemeProvider theme={accordionTheme}>
            <Accordion
                className="mission-accordion"
                expanded={props.isExpanded}
                onChange={(_event, expanded) => props.onAccordionChange(props.missionID, expanded)}
            >
                <AccordionSummary className={getSummaryClass()} expandIcon={<ExpandMoreIcon />}>
                    <MissionAccordionTitle missionID={props.missionID} />
                </AccordionSummary>
                <AccordionDetails className="mission-accordion-details">
                    <div className="mission-accordion-row">
                        <MissionAssignMenu missionID={props.missionID} />
                        <TextField
                            label="Repeats"
                            size="small"
                            className="mission-repeats"
                            autoComplete="off"
                            value={props.repeats}
                            onChange={(event) =>
                                props.onRepeatsChange(event.target.value, props.missionID)
                            }
                        />
                    </div>
                    <div className="mission-accordion-row">
                        <Button
                            className="jaia-button"
                            aria-label="duplicate-mission"
                            data-testid={`duplicate-mission-${props.missionID}`}
                            onClick={() => props.onDuplicateClick(props.missionID)}
                        >
                            <Icon
                                path={mdiContentDuplicate}
                                size={MDI_BUTTON_SIZE}
                                title="Duplicate Mission"
                            />
                        </Button>
                        <DeleteMissionButton deleteAll={false} missionID={props.missionID} />
                        <JaiaToggle
                            checked={() => props.isInEditMode}
                            onClick={() => props.onToggleEditClick(props.missionID)}
                            label="Edit"
                            title="ToggleEditMode"
                            testLabel={`Edit Mission ${props.missionID}`}
                        />
                    </div>
                </AccordionDetails>
            </Accordion>
        </ThemeProvider>
    );
}

/**
 * Renders the title bar content for a mission accordion
 *
 * @param {number} props.missionID Used to look up the assigned bot
 * @returns {JSX.Element} Mission ID and bot assignment labels
 */
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

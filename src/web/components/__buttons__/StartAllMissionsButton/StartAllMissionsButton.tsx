import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { StartAllMissionsDialog } from "./StartAllMissionsDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiPlay } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import Mission from "../../../data/mission_set/mission";

import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { fetchBatteryPrediction } from "../../../data/battery_predictions/battery-prediction-calculator";

import { Command, CommandType } from "../../../types/protobuf-types";
import { ButtonNames, ButtonTypes, DialogActions } from "../../../types/context-types";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";
import { MDI_BUTTON_SIZE, MIN_BATTERY_PERCENT, UNASSIGNED_ID } from "../../../utils/constants";

interface Props {
    bots: Map<number, Bot>;
    missions: Map<number, Mission>;
    missionSetName: string;
}

type DisabledCodeGroup = [DisabledCodes, number[]];

/**
 * Produces the button to start all missions.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StartAllMissionsButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [botReadyStates, setBotReadyStates] = useState(
        new Map<DisabledCodes, number[]>(initBotReadyStates()),
    );
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Loops through the connected Bots and categorizes them based on their
     * readiness to start a mission, fetching a fresh battery prediction per Bot rather
     * than reading the periodically-updated cache -- this is the moment commands are
     * about to be sent, so a stale "safe to start" read here is worse than the brief pause.
     *
     * @returns {void}
     */
    const groupBotsByReadyState = async () => {
        const updatedBotReadyStates = new Map<DisabledCodes, number[]>(initBotReadyStates());

        await Promise.all(
            Array.from(props.bots.entries()).map(async ([botID, bot]) => {
                const disabledCode = await getBotReadyState(botID, bot, props.missions);
                updatedBotReadyStates.get(disabledCode).push(botID);
            }),
        );

        setBotReadyStates(updatedBotReadyStates);
    };

    /**
     * Triggers the state to open the alert/confirm dialog box with the Bots
     * categorized to produce the correct alert/confirm message
     *
     * @returns {void}
     */
    const handleClick = async () => {
        if (props.bots.size === 0) {
            return;
        }

        const hasControl = isControllingClient();

        if (!hasControl) {
            setIsTakeControlVisible(true);
        } else {
            await groupBotsByReadyState();
            setIsDialogVisible(true);
            jaiaDispatch({
                type: JaiaActions.CLICKED_BUTTON,
                buttonType: ButtonTypes.COMMAND,
                buttonName: ButtonNames.START_ALL_MISSIONS,
            });
        }
    };

    /**
     * Closes the dialog box and follows up on the operator's action
     *
     * @param {DialogActions} dialogAction The operators action on the dialog box
     * @returns {void}
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            for (const botID of botReadyStates.get(DisabledCodes.NONE)) {
                const missionID = missionsManager.getMissionID(botID);
                const missionPlan = props.missions
                    .get(missionID)
                    .packageMissionForHub(props.missionSetName);

                const startMissionCommand: Command = {
                    bot_id: botID,
                    type: CommandType.MISSION_PLAN,
                    plan: missionPlan,
                };
                const res = await sendBotCommand(startMissionCommand);
                if (res.status === "ok") {
                    jaiaDispatch({ type: JaiaActions.SENT_COMMAND, command: startMissionCommand });
                }
            }
        }
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"start-all-missions"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiPlay} size={MDI_BUTTON_SIZE} title="Start All Missions" />
            </Button>
            <StartAllMissionsDialog
                isVisible={isDialogVisible}
                botReadyStates={botReadyStates}
                numBots={props.bots.size}
                onClose={onDialogClose}
            />
            <TakeControlDialog
                isVisible={isTakeControlVisible}
                setIsTakeControlVisible={setIsTakeControlVisible}
                setIsDialogVisible={setIsDialogVisible}
                groupBotsByReadyState={groupBotsByReadyState}
            />
        </div>
    );
}

/**
 * Maps each disabled code to an empty array to prevent undefined behavior
 *
 * @returns {Map<DisabledCodes, number[]>} Disabled codes mapped to an empty array for Bot IDs
 */
function initBotReadyStates() {
    const botReadyStates: DisabledCodeGroup[] = [
        [DisabledCodes.NONE, []],
        [DisabledCodes.NO_COMMS, []],
        [DisabledCodes.MISSION_STATE, []],
        [DisabledCodes.NO_MISSION, []],
        [DisabledCodes.DOWNLOAD_QUEUE, []],
        [DisabledCodes.LOW_BATTERY, []],
        [DisabledCodes.INSUFFICIENT_BATTERY, []],
    ];
    return botReadyStates;
}

/**
 * Checks whether the supplied Bot ID is associated with a mission
 *
 * @param {number} botID Used in mission lookup
 * @returns {boolean} True if the Bot does not have an assigned mission
 */
function isMissionUnassigned(botID: number) {
    return missionsManager.getMissionID(botID) === UNASSIGNED_ID;
}

/**
 * Checks whether the supplied battery percent is below the min threshold
 *
 * @param {number} batteryPercent Bot's battery percent
 * @returns {boolean} True if the Bots battery is below the min threshold
 */
function isCritiallyLowBattery(batteryPercent: number) {
    return batteryPercent < MIN_BATTERY_PERCENT;
}

/**
 * Determines the disabled code that applies to a single Bot for the start-all-missions flow
 *
 * @param {number} botID Bot to evaluate
 * @param {Bot} bot The Bot instance
 * @param {Map<number, Mission>} missions Missions keyed by mission ID, used to look up the Bot's assigned mission
 * @returns {Promise<DisabledCodes>} The applicable disabled code for this Bot
 */
async function getBotReadyState(
    botID: number,
    bot: Bot,
    missions: Map<number, Mission>,
): Promise<DisabledCodes> {
    if (bot.isCommsDropped()) {
        return DisabledCodes.NO_COMMS;
    }

    if (!isCommandAvailable(CommandType.START_MISSION, bot.getMissionStatus().missionState)) {
        return DisabledCodes.MISSION_STATE;
    }

    if (isMissionUnassigned(botID)) {
        return DisabledCodes.NO_MISSION;
    }

    if (isCritiallyLowBattery(bot.getBatteryPercent())) {
        return DisabledCodes.LOW_BATTERY;
    }

    const missionID = missionsManager.getMissionID(botID);
    const mission = missions.get(missionID);
    const prediction = mission ? await fetchBatteryPrediction(mission, bot) : null;
    // A null prediction (unsupported bot type, request failure, etc.)
    // intentionally does not block starting the mission -- the battery check is
    // advisory, not a safety gate, so we fail open when we have no prediction to check.
    if (prediction !== null && prediction.predicted_final_pct < MIN_BATTERY_PERCENT) {
        return DisabledCodes.INSUFFICIENT_BATTERY;
    }

    return DisabledCodes.NONE;
}

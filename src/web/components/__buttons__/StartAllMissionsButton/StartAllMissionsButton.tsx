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

import { Command, Command_CommandType } from "../../../shared/proto/jaiabot/messages/jaia_dccl";
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
     * readiness to start a mission. This sets the foundation for creating the correct
     * alert/confirm message.
     *
     * @returns {void}
     */
    const groupBotsByReadyState = () => {
        const updatedBotReadyStates = new Map<DisabledCodes, number[]>(initBotReadyStates());

        for (const [botID, bot] of props.bots.entries()) {
            if (bot.isCommsDropped()) {
                updatedBotReadyStates.get(DisabledCodes.NO_COMMS).push(botID);
            } else if (
                !isCommandAvailable(
                    Command_CommandType.START_MISSION,
                    bot.getMissionStatus().missionState,
                )
            ) {
                updatedBotReadyStates.get(DisabledCodes.MISSION_STATE).push(botID);
            } else if (isMissionUnassigned(botID)) {
                updatedBotReadyStates.get(DisabledCodes.NO_MISSION).push(botID);
            }

            // Download queue
            else if (isCritiallyLowBattery(bot.getBatteryPercent())) {
                updatedBotReadyStates.get(DisabledCodes.LOW_BATTERY).push(botID);
            } else {
                updatedBotReadyStates.get(DisabledCodes.NONE).push(botID);
            }
        }

        setBotReadyStates(updatedBotReadyStates);
    };

    /**
     * Triggers the state to open the alert/confirm dialog box with the Bots
     * categorized to produce the correct alert/confirm message
     *
     * @returns {void}
     */
    const handleClick = () => {
        if (props.bots.size === 0) {
            return;
        }

        const hasControl = isControllingClient();

        if (!hasControl) {
            setIsTakeControlVisible(true);
        } else {
            groupBotsByReadyState();
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
                    type: Command_CommandType.MISSION_PLAN,
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

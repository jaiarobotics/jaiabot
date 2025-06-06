import { useState } from "react";

import { StartAllMissionsDialog, DialogActions } from "./StartAllMissionsDialog";
import { DisabledCodes } from "../StartMissionButton/start-mission-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiPlay } from "@mdi/js";

import Bot from "../../data/bots/bot";
import Mission from "../../data/missions/mission";

import { missionsManager } from "../../data/missions_manager/missions-manager";

import { Command, CommandType } from "../../types/protobuf-types";
import { isCommandAvailable, sendBotCommand } from "../../utils/commands";
import { microsecondsToSeconds } from "../../utils/conversions";
import { MIN_BATTERY_PERCENT, NO_COMMS_STATUS_AGE, UNASSIGNED_ID } from "../../utils/constants";

interface Props {
    bots: Map<number, Bot>;
    missions: Map<number, Mission>;
}

type DisabledCodeGroup = [DisabledCodes, number[]];

/**
 * Produces the button to start all missions.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StartAllMissionsButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [botReadyStates, setBotReadyStates] = useState(
        new Map<DisabledCodes, number[]>(initBotReadyStates()),
    );

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
            if (isCommsDropped(bot.getStatusAge())) {
                updatedBotReadyStates.get(DisabledCodes.NO_COMMS).push(botID);
            } else if (
                !isCommandAvailable(CommandType.START_MISSION, bot.getMissionStatus().missionState)
            ) {
                updatedBotReadyStates.get(DisabledCodes.MISSION_STATE).push(botID);
            } else if (isMissionUnassigned(botID)) {
                updatedBotReadyStates.get(DisabledCodes.NO_MISSION_ASSIGNED).push(botID);
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
        setIsDialogVisible(true);
        groupBotsByReadyState();
    };

    /**
     * Closes the dialog box and follows up on the operator's action
     *
     * @param {DialogActions} dialogAction The operators action on the dialog box
     * @returns {void}
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            for (const botID of botReadyStates.get(DisabledCodes.NONE)) {
                const startMissionCommand: Command = {
                    bot_id: botID,
                    type: CommandType.MISSION_PLAN,
                    plan: props.missions
                        .get(missionsManager.getMissionID(botID))
                        .packageMissionForHub(),
                };
                sendBotCommand(startMissionCommand);
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
                <Icon path={mdiPlay} title="Start All Missions" />
            </Button>
            <StartAllMissionsDialog
                isVisible={isDialogVisible}
                botReadyStates={botReadyStates}
                numBots={props.bots.size}
                onClose={onDialogClose}
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
        [DisabledCodes.NO_MISSION_ASSIGNED, []],
        [DisabledCodes.DOWNLOAD_QUEUE, []],
        [DisabledCodes.LOW_BATTERY, []],
    ];
    return botReadyStates;
}

/**
 * Checks the supplied status age against the no comms threshold
 *
 * @param {number} statusAge Bot's status age in microseconds
 * @returns {boolean} True if the Bot does not have comms with the Hub
 */
function isCommsDropped(statusAge: number) {
    return microsecondsToSeconds(statusAge) > NO_COMMS_STATUS_AGE;
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

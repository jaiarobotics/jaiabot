import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";
import RallyPoint from "../../../data/rally_points/rally-point";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { GoToRallyDialog } from "./GoToRallyDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiPlay } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import { DialogActions } from "../../../types/context-types";

import { Command, Command_CommandType } from "../../../shared/proto/jaiabot/messages/jaia_dccl";
import {
    MissionPlan_MissionStart,
    MissionPlan_MovementType,
    Speeds,
} from "../../../shared/proto/jaiabot/messages/mission";
import { ButtonNames, ButtonTypes } from "../../../types/context-types";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";
import { isCritiallyLowBattery } from "../button-utils";

interface Props {
    bots: Map<number, Bot>;
    rallyPoint: RallyPoint;
    missionSpeeds: Speeds;
}

type DisabledCodeGroup = [DisabledCodes, number[]];

/**
 * Produces the button to send all bots to a rally point.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function GoToRallyButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [botReadyStates, setBotReadyStates] = useState(
        new Map<DisabledCodes, number[]>(initBotReadyStates()),
    );
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Loops through the connected Bots and categorizes them based on their
     * readiness to go to a rally point. This sets the foundation for creating the correct
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
        const hasControl = isControllingClient();

        if (!hasControl) {
            setIsTakeControlVisible(true);
        } else {
            groupBotsByReadyState();
            setIsDialogVisible(true);
            jaiaDispatch({
                type: JaiaActions.CLICKED_BUTTON,
                buttonType: ButtonTypes.COMMAND,
                buttonName: ButtonNames.GO_TO_RALLY,
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
                const res = await sendBotCommand(getRallyCommand(botID));
                if (res.status === "ok") {
                    jaiaDispatch({ type: JaiaActions.SEND_RALLY_MISSION });
                }
            }
        }
    };

    /**
     * Creates the command to send a Bot to the selected rally point
     *
     * @param {number} botID Which Bot will receive the command
     * @returns {Command} Single point mission command
     */
    const getRallyCommand = (botID: number) => {
        const rallyPointLocation = props.rallyPoint.getLocation();
        const rallyCommand: Command = {
            bot_id: botID,
            type: Command_CommandType.MISSION_PLAN,
            plan: {
                start: MissionPlan_MissionStart.START_IMMEDIATELY,
                movement: MissionPlan_MovementType.TRANSIT,
                goal: [{ location: rallyPointLocation }],
                recovery: {
                    recover_at_final_goal: true,
                },
                speeds: props.missionSpeeds,
            },
        };
        return rallyCommand;
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"go-to-rally-point"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiPlay} size={MDI_BUTTON_SIZE} title="Go To Rally Point" />
            </Button>
            <GoToRallyDialog
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
        [DisabledCodes.DOWNLOAD_QUEUE, []],
        [DisabledCodes.LOW_BATTERY, []],
    ];
    return botReadyStates;
}

import { useState } from "react";

import TakeControlDialog from "../TakeControlDialog/TakeControlDialog";
import { ActivateAllDialog } from "./ActivateAllDialog";
import { DisabledCodes } from "../ActivateButton/activate-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiCheckboxMarkedCirclePlusOutline } from "@mdi/js";

import Bot from "../../data/bots/bot";

import { MDI_BUTTON_SIZE, NO_COMMS_STATUS_AGE } from "../../utils/constants";
import { microsecondsToSeconds } from "../../utils/conversions";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../utils/commands";
import { Command, CommandType } from "../../types/protobuf-types";
import { DialogActions } from "../../types/context-types";

interface Props {
    bots: Map<number, Bot>;
}

type DisabledCodeGroup = [DisabledCodes, number[]];

/**
 * Produces the button to activate all Bots.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function ActivateAllButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [botReadyStates, setBotReadyStates] = useState(
        new Map<DisabledCodes, number[]>(initBotReadyStates()),
    );
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Loops through the connected Bots and categorizes them based on their
     * ability to be activated. This sets the foundation for creating the correct
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
                !isCommandAvailable(CommandType.ACTIVATE, bot.getMissionStatus().missionState)
            ) {
                updatedBotReadyStates.get(DisabledCodes.MISSION_STATE).push(botID);
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
    const handleClick = async () => {
        const hasControl = await isControllingClient();

        if (!hasControl) {
            setIsTakeControlVisible(true);
        } else {
            setIsDialogVisible(true);
            groupBotsByReadyState();
        }
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
                const activateCommand: Command = {
                    bot_id: botID,
                    type: CommandType.ACTIVATE,
                };
                sendBotCommand(activateCommand);
            }
        }
    };

    /**
     * Closes the take control dialog. If control is taken, the command
     * dialog will appear.
     *
     * @param {DialogActions} dialogAction The action taken by the operator
     * @returns {void}
     */
    const onTakeControlClose = (dialogAction: DialogActions) => {
        setIsTakeControlVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            setIsDialogVisible(true);
            groupBotsByReadyState();
        }
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"activate-all-bots"}
                onClick={() => handleClick()}
            >
                <Icon
                    path={mdiCheckboxMarkedCirclePlusOutline}
                    size={MDI_BUTTON_SIZE}
                    title="Activate All"
                />
            </Button>
            <ActivateAllDialog
                isVisible={isDialogVisible}
                botReadyStates={botReadyStates}
                numBots={props.bots.size}
                onClose={onDialogClose}
            />
            <TakeControlDialog isVisible={isTakeControlVisible} onClose={onTakeControlClose} />
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

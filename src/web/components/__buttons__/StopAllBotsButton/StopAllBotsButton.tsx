import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { StopAllBotsDialog } from "./StopAllBotsDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiStop } from "@mdi/js";

import Bot from "../../../data/bots/bot";

import { DialogActions } from "../../../types/context-types";
import { Command, CommandType } from "../../../types/protobuf-types";
import { Link } from "../../../shared/JAIAProtobuf";
import { isCommandAvailable, isControllingClient, sendBotCommandWithTracking } from "../../../utils/commands";
import { microsecondsToSeconds } from "../../../utils/conversions";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";
import { getNoCommsTimeout } from "../../BotDetails/bot-details";

interface Props {
    bots: Map<number, Bot>;
}

type DisabledCodeGroup = [DisabledCodes, number[]];

/**
 * Produces the button to stop all Bots.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StopAllBotsButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [botReadyStates, setBotReadyStates] = useState(
        new Map<DisabledCodes, number[]>(initBotReadyStates()),
    );
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Loops through the connected Bots and categorizes them based on their
     * ability to be stopped. This sets the foundation for creating the correct
     * alert/confirm message.
     *
     * @returns {void}
     */
    const groupBotsByReadyState = () => {
        const updatedBotReadyStates = new Map<DisabledCodes, number[]>(initBotReadyStates());

        for (const [botID, bot] of props.bots.entries()) {
            if (isCommsDropped(bot.getStatusAge(), bot.getLink())) {
                updatedBotReadyStates.get(DisabledCodes.NO_COMMS).push(botID);
            } else if (!isCommandAvailable(CommandType.STOP, bot.getMissionStatus().missionState)) {
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
                const stopCommand: Command = {
                    bot_id: botID,
                    type: CommandType.STOP,
                };
                await sendBotCommandWithTracking(stopCommand, jaiaDispatch);
            }
        }
    };

    return (
        <div>
            <Button
                className={"jaia-button stop"}
                aria-label={"stop-all-bots"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiStop} size={MDI_BUTTON_SIZE} title="Stop All Bots" />
            </Button>
            <StopAllBotsDialog
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
    ];
    return botReadyStates;
}

/**
 * Checks the supplied status age against the no comms threshold
 *
 * @param {number} statusAge Bot's status age in microseconds
 * @param {Link} link The link type from the last BotStatus message
 * @returns {boolean} True if the Bot does not have comms with the Hub
 */
function isCommsDropped(statusAge: number, link?: Link) {
    return microsecondsToSeconds(statusAge) > getNoCommsTimeout(link);
}

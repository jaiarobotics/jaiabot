import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { StopDialog } from "./StopDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiStop } from "@mdi/js";

import Bot, { BotCommandStatus } from "../../../data/bots/bot";

import { Command, CommandType } from "../../../types/protobuf-types";
import { DialogActions } from "../../../types/context-types";
import { MDI_BUTTON_SIZE, NO_COMMS_STATUS_AGE } from "../../../utils/constants";
import { microsecondsToSeconds } from "../../../utils/conversions";
import {
    isCommandAvailable,
    isControllingClient,
    sendBotCommandWithTracking,
} from "../../../utils/commands";

interface Props {
    bot: Bot;
}

/**
 * Produces the stop button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StopButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Forms the style of the button (light if enabled, dark if disabled)
     *
     * @returns {string} General class name jaia-button plus enable/disable factor
     */
    const getClassName = () => {
        let className = "jaia-button";

        if (getDisabledCode() !== DisabledCodes.NONE) {
            className += " disabled";
        }

        return className;
    };

    /**
     * Checks the Bot's state and decides what disabled code (if any) applies based on the button conditions
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Bot and button conditions
     */
    const getDisabledCode = () => {
        if (microsecondsToSeconds(props.bot.getStatusAge()) > NO_COMMS_STATUS_AGE) {
            if (props.bot.getCommandStatus() === BotCommandStatus.PENDING) {
                return DisabledCodes.AWAITING_ACK;
            }
        }
        if (!isCommandAvailable(CommandType.STOP, props.bot.getMissionStatus().missionState)) {
            return DisabledCodes.MISSION_STATE;
        }
        return DisabledCodes.NONE;
    };

    /**
     * Determines what dialog to display on click (take control or activate)
     *
     * @returns {void}
     */
    const handleClick = () => {
        const hasControl = isControllingClient();

        if (!hasControl && getDisabledCode() === DisabledCodes.NONE) {
            setIsTakeControlVisible(true);
        } else {
            setIsDialogVisible(true);
        }
    };

    /**
     * Closes the dialog box then acts based on the type of button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     *
     * @notes
     * After refactoring the command structure, issue the stop command
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const stopCommand: Command = {
                bot_id: props.bot.getBotID(),
                type: CommandType.STOP,
            };
            await sendBotCommandWithTracking(stopCommand, jaiaDispatch);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"stop-individual-bot"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiStop} size={MDI_BUTTON_SIZE} title="Stop Mission" />
            </Button>
            <StopDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
            <TakeControlDialog
                isVisible={isTakeControlVisible}
                setIsTakeControlVisible={setIsTakeControlVisible}
                setIsDialogVisible={setIsDialogVisible}
            />
        </div>
    );
}

import { useState } from "react";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { NextTaskDialog } from "./NextTaskDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiSkipNext } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import { DialogActions } from "../../../types/context-types";
import { Command, Command_CommandType } from "../../../shared/proto/jaiabot/messages/jaia_dccl";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";

interface Props {
    bot: Bot;
}

/**
 * Produces the next task button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function NextTaskButton(props: Props) {
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
        if (
            !isCommandAvailable(
                Command_CommandType.NEXT_TASK,
                props.bot.getMissionStatus().missionState,
            )
        ) {
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
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const nextTaskCommand: Command = {
                bot_id: props.bot.getBotID(),
                type: Command_CommandType.NEXT_TASK,
            };
            sendBotCommand(nextTaskCommand);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"next-task"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiSkipNext} size={MDI_BUTTON_SIZE} title="Next Task" />
            </Button>
            <NextTaskDialog
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

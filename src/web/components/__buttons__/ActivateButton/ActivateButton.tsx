import { useState } from "react";

import TakeControlDialog from "../../TakeControlDialog/TakeControlDialog";
import { ActivateDialog } from "./ActivateDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiCheckboxMarkedCirclePlusOutline } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import { DialogActions } from "../../../types/context-types";
import { Command, CommandType } from "../../../types/protobuf-types";
import { MDI_BUTTON_SIZE, NO_COMMS_STATUS_AGE } from "../../../utils/constants";
import { microsecondsToSeconds } from "../../../utils/conversions";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";

interface Props {
    bot: Bot;
}

/**
 * Produces the activate button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function ActivateButton(props: Props) {
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
            return DisabledCodes.NO_COMMS;
        }

        if (!isCommandAvailable(CommandType.ACTIVATE, props.bot.getMissionStatus().missionState)) {
            return DisabledCodes.MISSION_STATE;
        }
        return DisabledCodes.NONE;
    };

    /**
     * Determines what dialog to display on click (take control or activate)
     *
     * @returns {void}
     */
    const handleClick = async () => {
        const hasControl = await isControllingClient();

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
     * After refactoring the command structure, issue the activate command
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const activateCommand: Command = {
                bot_id: props.bot.getBotID(),
                type: CommandType.ACTIVATE,
            };
            sendBotCommand(activateCommand);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"activate-individual-bot"}
                onClick={() => handleClick()}
            >
                <Icon
                    path={mdiCheckboxMarkedCirclePlusOutline}
                    size={MDI_BUTTON_SIZE}
                    title="System Check"
                />
            </Button>
            <ActivateDialog
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

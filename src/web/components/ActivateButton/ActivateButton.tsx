import { useState } from "react";

import { ActivateDialog, DialogActions } from "./ActivateDialog";
import { DisabledCodes } from "./activate-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiCheckboxMarkedCirclePlusOutline } from "@mdi/js";

import Bot from "../../data/bots/bot";
import { Command, CommandType } from "../../types/protobuf-types";
import { isCommandAvailable, sendBotCommand } from "../../utils/commands";

import "../../style/stylesheets/util.less";

interface Props {
    bot: Bot;
}

/**
 * Produces the activate button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function ActivateButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

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
        if (!isCommandAvailable(CommandType.ACTIVATE, props.bot.getMissionStatus().missionState)) {
            return DisabledCodes.MISSION_STATE;
        }
        return DisabledCodes.NONE;
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
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiCheckboxMarkedCirclePlusOutline} title="System Check" />
            </Button>
            <ActivateDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}

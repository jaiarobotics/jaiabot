import { useState } from "react";

import { StopDialog, DialogActions } from "./StopDialog";
import { DisabledCodes } from "./stop-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiStop } from "@mdi/js";

import Bot from "../../data/bots/bot";
import { CommandType } from "../../types/protobuf-types";
import { isCommandAvailable } from "../../utils/command";

import "../../style/stylesheets/util.less";

interface Props {
    bot: Bot;
}

/**
 * Produces the stop button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StopButton(props: Props) {
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
        if (!isCommandAvailable(CommandType.STOP, props.bot.getMissionStatus().missionState)) {
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
     * After refactoring the command structure, issue the stop command
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            // Send stop command
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"stop-individual-bot"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiStop} title="Stop Mission" />
            </Button>
            <StopDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}

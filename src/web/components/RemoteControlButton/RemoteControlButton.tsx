import { useContext, useState } from "react";

import { RemoteControlDialog, DialogActions } from "./RemoteControlDialog";
import { DisabledCodes } from "./remote-control-messages";

import { Button } from "@mui/material";

import Bot from "../../data/bots/bot";
import { Command, CommandType, MovementType } from "../../types/protobuf-types";
import { isCommandAvailable, sendBotCommand } from "../../utils/commands";

import rcModeIcon from "../../style/icons/controller.svg";
import { JaiaDispatchContext } from "../../context/JaiaContext";
import { JaiaActions } from "../../context/jaia-actions";

interface Props {
    bot: Bot;
}

/**
 * Produces the button to enter remote control mode.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function RemoteControlButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
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
        if (
            !isCommandAvailable(
                CommandType.REMOTE_CONTROL_TASK,
                props.bot.getMissionStatus().missionState,
            )
        ) {
            return DisabledCodes.MISSION_STATE;
        }
        return DisabledCodes.NONE;
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
            const enterRCCommand = getEnterRCCommand(props.bot);
            sendBotCommand(enterRCCommand);
            jaiaDispatch({
                type: JaiaActions.SENT_COMMAND,
                botID: props.bot.getBotID(),
                command: enterRCCommand,
            });
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"enter-remote-control"}
                onClick={() => setIsDialogVisible(true)}
            >
                <img src={rcModeIcon} title="Enter Remote Control"></img>
            </Button>
            <RemoteControlDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}

/**
 * Packages the Bot data into a command to enter RC mode
 *
 * @param {Bot} bot Provides the ID and location
 * @returns {Command} Command to enter RC mode
 */
function getEnterRCCommand(bot: Bot) {
    // Bot requires location to be set if no recovery at waypoint
    let location = bot.getLocation();
    if (!location) {
        location = { lat: 0, lon: 0 };
    }

    const enterRCCommand: Command = {
        bot_id: bot.getBotID(),
        type: CommandType.MISSION_PLAN,
        plan: {
            movement: MovementType.REMOTE_CONTROL,
            recovery: {
                recover_at_final_goal: false,
                location: location,
            },
        },
    };

    return enterRCCommand;
}

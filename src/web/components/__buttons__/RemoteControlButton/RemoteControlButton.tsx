import { useContext, useState } from "react";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { RemoteControlDialog } from "./RemoteControlDialog";
import { DisabledCodes } from "../disabled-codes";

import { Button } from "@mui/material";

import Bot from "../../../data/bots/bot";
import { BotModes } from "../../../types/jaia-system-types";
import { DialogActions } from "../../../types/context-types";
import { Command, Command_CommandType } from "../../../shared/proto/jaiabot/messages/jaia_dccl";
import {
    MissionPlan_MissionStart,
    MissionPlan_MovementType,
} from "../../../shared/proto/jaiabot/messages/mission";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";

import rcModeIcon from "../../../style/icons/controller.svg";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import "./RemoteControlButton.less";

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
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    const rcActive = props.bot.getMode() === BotModes.REMOTE_CONTROL;

    /**
     * Forms the style of the button (light if enabled, dark if disabled)
     *
     * @returns {string} General class name jaia-button plus enable/disable factor
     */
    const getClassName = () => {
        let className = "jaia-button";

        if (rcActive) {
            className += " rc-active";
            return className;
        }

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
        if (rcActive) {
            return DisabledCodes.NONE__EXIT_RC;
        }

        if (
            !isCommandAvailable(
                Command_CommandType.REMOTE_CONTROL_TASK,
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
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const command = rcActive ? getExitRCCommand(props.bot) : getEnterRCCommand(props.bot);
            const response = await sendBotCommand(command);
            if (response && response.status === "ok") {
                jaiaDispatch({
                    type: JaiaActions.SENT_COMMAND,
                    botID: props.bot.getBotID(),
                    command: command,
                });
            }
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={rcActive ? "exit-remote-control" : "enter-remote-control"}
                onClick={() => handleClick()}
            >
                <img
                    src={rcModeIcon}
                    title={rcActive ? "Exit Remote Control" : "Enter Remote Control"}
                ></img>
            </Button>
            <RemoteControlDialog
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
        type: Command_CommandType.MISSION_PLAN,
        plan: {
            start: MissionPlan_MissionStart.START_IMMEDIATELY,
            movement: MissionPlan_MovementType.REMOTE_CONTROL,
            recovery: {
                recover_at_final_goal: false,
                location: location,
            },
        },
    };

    return enterRCCommand;
}

/**
 * Packages the Bot data into a command to exit RC mode
 *
 * @param {Bot} bot Provides the ID
 * @returns {Command} Command to exit RC mode
 */
function getExitRCCommand(bot: Bot) {
    const stopCommand: Command = {
        bot_id: bot.getBotID(),
        type: Command_CommandType.STOP,
    };
    return stopCommand;
}

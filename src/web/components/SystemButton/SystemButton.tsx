import { useState } from "react";

import { SystemDialog, DialogActions } from "./SystemDialog";
import { DisabledCodes } from "./system-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiPower, mdiRestart, mdiRestartAlert } from "@mdi/js";

import Bot from "../../data/bots/bot";
import { SystemButtonTypes } from "../../types/jaia-system-types";
import { Command, CommandType } from "../../types/protobuf-types";
import { isCommandAvailable, sendBotCommand } from "../../utils/commands";

interface Props {
    bot: Bot;
    type: SystemButtonTypes;
}

/**
 * Produces a system button for an individual Bot (Shutdown, Reboot, Restart Services).
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function SystemButton(props: Props) {
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
     * Provides the aria label based on system button type
     *
     * @returns {string} Aria label for the button
     */
    const getAriaLabel = () => {
        switch (props.type) {
            case SystemButtonTypes.SHUTDOWN:
                return "shutdown-individual-bot";
            case SystemButtonTypes.REBOOT:
                return "reboot-individual-bot";
            case SystemButtonTypes.RESTART_SERVICES:
                return "restart-services-individual-bot";
        }
    };

    /**
     * Provides the icon path based on system button type
     *
     * @returns {string} Icon path for the button
     */
    const getIconPath = () => {
        switch (props.type) {
            case SystemButtonTypes.SHUTDOWN:
                return mdiPower;
            case SystemButtonTypes.REBOOT:
                return mdiRestartAlert;
            case SystemButtonTypes.RESTART_SERVICES:
                return mdiRestart;
        }
    };

    /**
     * Provides the tool tip label based on system button type
     *
     * @returns {string} Title for the button
     */
    const getIconTitle = () => {
        switch (props.type) {
            case SystemButtonTypes.SHUTDOWN:
                return "Shutdown";
            case SystemButtonTypes.REBOOT:
                return "Restart";
            case SystemButtonTypes.RESTART_SERVICES:
                return "Restart Services";
        }
    };

    /**
     * Provides the CommandType based on system button type
     *
     * @returns {CommandType} Command that maps to the button
     */
    const getCommandType = () => {
        switch (props.type) {
            case SystemButtonTypes.SHUTDOWN:
                return CommandType.SHUTDOWN;
            case SystemButtonTypes.REBOOT:
                return CommandType.REBOOT_COMPUTER;
            case SystemButtonTypes.RESTART_SERVICES:
                return CommandType.RESTART_ALL_SERVICES;
        }
    };

    /**
     * Checks the Bot's state and decides what disabled code (if any) applies based on the button conditions
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Bot and button conditions
     */
    const getDisabledCode = () => {
        if (!isCommandAvailable(getCommandType(), props.bot.getMissionStatus().missionState)) {
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
            const command: Command = {
                bot_id: props.bot.getBotID(),
                type: getCommandType(),
            };
            sendBotCommand(command);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={getAriaLabel()}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={getIconPath()} title={getIconTitle()} />
            </Button>
            <SystemDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
                systemButton={props.type}
            />
        </div>
    );
}

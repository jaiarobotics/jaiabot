import { useState } from "react";

import { SystemDialog, DialogActions } from "./SystemDialog";
import { DisabledCodes } from "./system-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiPower, mdiRestart, mdiRestartAlert } from "@mdi/js";

import Bot from "../../data/bots/bot";
import Hub from "../../data/hubs/hub";
import { SystemButtonTypes } from "../../types/jaia-system-types";
import { Command, CommandType, HubCommandType, CommandForHub } from "../../types/protobuf-types";
import { MDI_BUTTON_SIZE } from "../../utils/constants";
import { isCommandAvailable, sendBotCommand, sendHubCommand } from "../../utils/commands";

interface Props {
    node: Bot | Hub;
    type: SystemButtonTypes;
}

/**
 * Produces a system button for an individual Bot or Hub (Shutdown, Reboot, Restart Services).
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
        const nodeString = props.node instanceof Bot ? "individual-bot" : "hub";
        switch (props.type) {
            case SystemButtonTypes.SHUTDOWN:
                return "shutdown-" + nodeString;
            case SystemButtonTypes.REBOOT:
                return "reboot-" + nodeString;
            case SystemButtonTypes.RESTART_SERVICES:
                return "restart-services-" + nodeString;
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
                return "Reboot";
            case SystemButtonTypes.RESTART_SERVICES:
                return "Restart Services";
        }
    };

    /**
     * Provides the CommandType for a bot based on system button type
     *
     * @returns {CommandType} Command that maps to the button
     */
    const getBotCommandType = () => {
        if (props.node instanceof Bot) {
            switch (props.type) {
                case SystemButtonTypes.SHUTDOWN:
                    return CommandType.SHUTDOWN;
                case SystemButtonTypes.REBOOT:
                    return CommandType.REBOOT_COMPUTER;
                case SystemButtonTypes.RESTART_SERVICES:
                    return CommandType.RESTART_ALL_SERVICES;
            }
        }
    };

    /**
     * Provides the HubCommandType for a hub based on system button type
     *
     * @returns {HubCommandType} Command that maps to the button
     */
    const getHubCommandType = () => {
        if (props.node instanceof Hub) {
            switch (props.type) {
                case SystemButtonTypes.SHUTDOWN:
                    return HubCommandType.SHUTDOWN_COMPUTER; //TODO check command
                case SystemButtonTypes.REBOOT:
                    return HubCommandType.REBOOT_COMPUTER;
                case SystemButtonTypes.RESTART_SERVICES:
                    return HubCommandType.RESTART_ALL_SERVICES;
            }
        }
    };

    /**
     * Checks the Bot's state and decides what disabled code (if any) applies based on the button conditions
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Bot and button conditions
     */
    const getDisabledCode = () => {
        if (props.node instanceof Hub) {
            return DisabledCodes.NONE;
        } else if (props.node instanceof Bot) {
            if (
                !isCommandAvailable(getBotCommandType(), props.node.getMissionStatus().missionState)
            ) {
                return DisabledCodes.MISSION_STATE;
            }
            return DisabledCodes.NONE;
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
            if (props.node instanceof Bot) {
                const botCommand: Command = {
                    bot_id: props.node.getBotID(),
                    type: getBotCommandType(),
                };
                sendBotCommand(botCommand);
            } else if (props.node instanceof Hub) {
                const hubCommand: CommandForHub = {
                    hub_id: props.node.getHubID(),
                    type: getHubCommandType(),
                };
                sendHubCommand(hubCommand);
            }
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={getAriaLabel()}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={getIconPath()} size={MDI_BUTTON_SIZE} title={getIconTitle()} />
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

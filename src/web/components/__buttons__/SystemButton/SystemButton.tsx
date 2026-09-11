import { useState } from "react";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { SystemDialog } from "./SystemDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiPower, mdiRestart, mdiRestartAlert } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import Hub from "../../../data/hubs/hub";
import { DialogActions } from "../../../types/context-types";
import { SystemButtonTypes } from "../../../types/jaia-system-types";
import {
    CommandForHub_HubCommandType,
    Command_CommandType,
} from "../../../shared/proto/jaiabot/messages/jaia_dccl";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";
import {
    isCommandAvailable,
    isControllingClient,
    sendBotCommand,
    sendHubCommand,
} from "../../../utils/commands";

interface Props {
    node: Bot | Hub;
    type: SystemButtonTypes;
}

const botCommands: Map<SystemButtonTypes, Command_CommandType> = new Map([
    [SystemButtonTypes.SHUTDOWN, Command_CommandType.SHUTDOWN],
    [SystemButtonTypes.REBOOT, Command_CommandType.REBOOT_COMPUTER],
    [SystemButtonTypes.RESTART_SERVICES, Command_CommandType.RESTART_ALL_SERVICES],
]);

const hubCommands: Map<SystemButtonTypes, CommandForHub_HubCommandType> = new Map([
    [SystemButtonTypes.SHUTDOWN, CommandForHub_HubCommandType.SHUTDOWN_COMPUTER],
    [SystemButtonTypes.REBOOT, CommandForHub_HubCommandType.REBOOT_COMPUTER],
    [SystemButtonTypes.RESTART_SERVICES, CommandForHub_HubCommandType.RESTART_ALL_SERVICES],
]);

/**
 * Produces a system button for an individual Bot or Hub (Shutdown, Reboot, Restart Services).
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function SystemButton(props: Props) {
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
     * Provides the aria label based on system button type
     *
     * @returns {string} Aria label for the button
     */
    const getAriaLabel = () => {
        const node = props.node instanceof Bot ? "individual-bot" : "hub";
        switch (props.type) {
            case SystemButtonTypes.SHUTDOWN:
                return "shutdown-" + node;
            case SystemButtonTypes.REBOOT:
                return "reboot-" + node;
            case SystemButtonTypes.RESTART_SERVICES:
                return "restart-services-" + node;
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
     * Provides the Command_CommandType or CommandForHub_HubCommandType for a Bot or Hub based on system button type
     *
     * @param {Bot | Hub} node Type of node for which the button applies
     * @param {SystemButtonTypes} type Button to produce
     * @returns {Command_CommandType | CommandForHub_HubCommandType} Command that maps to the button type
     *
     * @notes
     * Function is overloaded to satsify type checking downstream
     */
    function getCommandType(node: Bot, type: SystemButtonTypes): Command_CommandType;
    function getCommandType(node: Hub, type: SystemButtonTypes): CommandForHub_HubCommandType;
    function getCommandType(node: Bot | Hub, type: SystemButtonTypes) {
        if (node instanceof Bot) {
            return botCommands.get(type);
        } else {
            return hubCommands.get(type);
        }
    }
    /**
     * Checks the Bot's state and decides what disabled code (if any) applies based on the button conditions
     *
     * @returns {DisabledCodes} The applicable disabled code based on the Bot and button conditions
     */
    const getDisabledCode = () => {
        if (props.node instanceof Hub) {
            return DisabledCodes.NONE;
        }
        if (
            !isCommandAvailable(
                getCommandType(props.node, props.type),
                props.node.getMissionStatus().missionState,
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

        if (dialogAction !== DialogActions.CONFIRMED) return;

        if (props.node instanceof Bot) {
            sendBotCommand({
                bot_id: props.node.getBotID(),
                type: getCommandType(props.node, props.type),
            });
        } else if (props.node instanceof Hub) {
            sendHubCommand({
                hub_id: props.node.getHubID(),
                type: getCommandType(props.node, props.type),
            });
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={getAriaLabel()}
                onClick={() => handleClick()}
            >
                <Icon path={getIconPath()} size={MDI_BUTTON_SIZE} title={getIconTitle()} />
            </Button>
            <SystemDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
                systemButton={props.type}
            />
            <TakeControlDialog
                isVisible={isTakeControlVisible}
                setIsTakeControlVisible={setIsTakeControlVisible}
                setIsDialogVisible={setIsDialogVisible}
            />
        </div>
    );
}

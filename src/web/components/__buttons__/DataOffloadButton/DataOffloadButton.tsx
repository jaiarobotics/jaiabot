import { useState } from "react";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { DataOffloadDialog } from "./DataOffloadDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDownload } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import { DialogActions } from "../../../types/context-types";
import { Command, Command_CommandType } from "../../../shared/proto/jaiabot/messages/jaia_dccl";
import { MissionState } from "../../../shared/proto/jaiabot/messages/mission";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";

interface Props {
    bot: Bot;
}

/**
 * Produces the data offload button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function DataOffloadButton(props: Props) {
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
     *
     * @notes
     * After data offload refactor, return DisabledCodes.DOWNLOAD_QUEUE if bot is already in queue
     */
    const getDisabledCode = () => {
        const missionState = props.bot.getMissionStatus().missionState;

        if (
            !(
                isCommandAvailable(Command_CommandType.RECOVERED, missionState) ||
                isCommandAvailable(Command_CommandType.RETRY_DATA_OFFLOAD, missionState)
            )
        ) {
            return DisabledCodes.MISSION_STATE;
        }

        if (!props.bot.getWifiLinkQuality()) {
            return DisabledCodes.WIFI_QUALITY;
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
     * After refactoring the command structure, issue the data offload command
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        let commandType = Command_CommandType.RECOVERED;
        if (props.bot.getMissionStatus().missionState === MissionState.POST_DEPLOYMENT__FAILED) {
            commandType = Command_CommandType.RETRY_DATA_OFFLOAD;
        }

        if (dialogAction === DialogActions.CONFIRMED) {
            const dataOffloadCommand: Command = {
                bot_id: props.bot.getBotID(),
                type: commandType,
            };
            sendBotCommand(dataOffloadCommand);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"data-offload-individual-bot"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiDownload} size={MDI_BUTTON_SIZE} title="Data Offload" />
            </Button>
            <DataOffloadDialog
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

import { useState } from "react";

import TakeControlDialog from "../../TakeControlDialog/TakeControlDialog";
// import TakeControlDialog from "../../TakeControlDialog/TakeControlDialog";
import { DataOffloadDialog } from "./DataOffloadDialog";
import { DisabledCodes } from "./data-offload-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDownload } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import { DialogActions } from "../../../types/context-types";
import { Command, CommandType } from "../../../types/protobuf-types";
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
        if (!isCommandAvailable(CommandType.RECOVERED, props.bot.getMissionStatus().missionState)) {
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
    const onButtonClick = async () => {
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
     * After refactoring the command structure, issue the data offload command
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const dataOffloadCommand: Command = {
                bot_id: props.bot.getBotID(),
                type: CommandType.RECOVERED,
            };
            sendBotCommand(dataOffloadCommand);
        }
    };

    /**
     * Closes the take control dialog. If control is taken, the command
     * dialog will appear.
     *
     * @param {DialogActions} dialogAction The action taken by the operator
     * @returns {void}
     */
    const onTakeControlClose = (dialogAction: DialogActions) => {
        setIsTakeControlVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            setIsDialogVisible(true);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"data-offload-individual-bot"}
                onClick={() => onButtonClick()}
            >
                <Icon path={mdiDownload} size={MDI_BUTTON_SIZE} title="Data Offload" />
            </Button>
            <DataOffloadDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
            <TakeControlDialog isVisible={isTakeControlVisible} onClose={onTakeControlClose} />
        </div>
    );
}

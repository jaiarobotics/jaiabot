import { useState } from "react";

import { DataOffloadDialog, DialogActions } from "./DataOffloadDialog";
import { DisabledCodes } from "./data-offload-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiDownload } from "@mdi/js";

import Bot from "../../data/bots/bot";
import { CommandType } from "../../utils/protobuf-types";
import { isCommandAvailable } from "../../utils/command";

import "../../style/stylesheets/util.less";

interface Props {
    bot: Bot;
}

/**
 * Produces the data offload button for an individual Bot. It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function DataOffloadButton(props: Props) {
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
     * Closes the dialog box then acts based on the type of button clicked
     *
     * @param {DialogActions} dialogAction Indicates which button was clicked
     * @returns {void}
     */
    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            // Send command
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"data-offload-individual"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiDownload} title="Data Offload" />
            </Button>
            <DataOffloadDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}

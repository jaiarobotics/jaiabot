import { useState } from "react";

import DataOffloadDialog from "./DataOffloadDialog";

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

export enum DisabledCodes {
    NONE = 0,
    MISSION_STATE = 1,
    WIFI_QUALITY = 2,
    DOWNLOAD_QUEUE = 3,
}

export enum DialogActions {
    NONE = 0,
    CONFIRMED = 1,
}

export default function DataOffloadButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);

    const getClassName = () => {
        let className = "jaia-button";

        if (getDisabledCode() !== DisabledCodes.NONE) {
            className += " disabled";
        }

        return className;
    };

    const getDisabledCode = () => {
        // If Bot is already in download queue
        //    return DisabledCodes.DOWNLOAD_QUEUE

        if (!isCommandAvailable(CommandType.RECOVERED, props.bot.getMissionStatus().missionState)) {
            return DisabledCodes.MISSION_STATE;
        }

        if (!props.bot.getWifiLinkQuality()) {
            return DisabledCodes.WIFI_QUALITY;
        }

        return DisabledCodes.NONE;
    };

    const handleClick = () => {
        setIsDialogVisible(true);
    };

    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            // Send command
        }
    };

    return (
        <div>
            <Button className={getClassName()} onClick={() => handleClick()}>
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

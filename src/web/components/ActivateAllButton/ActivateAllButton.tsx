import { useState } from "react";

import { ActivateAllDialog, DialogActions } from "./ActivateAllDialog";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiCheckboxMarkedCirclePlusOutline } from "@mdi/js";

import Bot from "../../data/bots/bot";
import { CommandType } from "../../types/protobuf-types";
import { isCommandAvailable } from "../../utils/commands";

import "../../style/stylesheets/util.less";

interface Props {
    bots: Map<number, Bot>;
}

export default function ActivateAllButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [availableBotIDs, setAvailableBotIDs] = useState([]);
    const [activatedBotIDs, setActivatedBotIDs] = useState([]);

    const groupBotsByState = () => {
        const tempAvailableBotIDs = [];
        const tempActivatedBotIDs = [];

        for (const [botID, bot] of props.bots.entries()) {
            if (!isCommandAvailable(CommandType.ACTIVATE, bot.getMissionStatus().missionState)) {
                tempActivatedBotIDs.push(bot.getBotID());
            } else {
                tempAvailableBotIDs.push(bot.getBotID());
            }
        }

        setAvailableBotIDs(tempAvailableBotIDs);
        setActivatedBotIDs(tempActivatedBotIDs);
    };

    const handleClick = () => {
        setIsDialogVisible(true);
        groupBotsByState();
    };

    const onDialogClose = (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            // Send activate command for available Bots
        }
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"activate-all-bots"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiCheckboxMarkedCirclePlusOutline} title="Activate All" />
            </Button>
            <ActivateAllDialog
                isVisible={isDialogVisible}
                availableBotIDs={availableBotIDs}
                activatedBotIDs={activatedBotIDs}
                onClose={onDialogClose}
            />
        </div>
    );
}

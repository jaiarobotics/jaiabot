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

/**
 * Produces the button to activate all Bots.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function ActivateAllButton(props: Props) {
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [availableBotIDs, setAvailableBotIDs] = useState([]);
    const [activatedBotIDs, setActivatedBotIDs] = useState([]);

    /**
     * Loops through the connected Bots and categorizes them based on their
     * readiness for the activate command. This sets the foundation for creating the correct
     * alert/confirm message.
     *
     * @returns {void}
     */
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

    /**
     * Triggers the state to open the alert/confirm dialog box with the Bots
     * categorized to produce the correct alert/confirm message
     *
     * @returns {void}
     */
    const handleClick = () => {
        setIsDialogVisible(true);
        groupBotsByState();
    };

    /**
     * Closes the dialog box and follows up on the operator's action
     *
     * @param {DialogActions} dialogAction The operators action on the dialog box
     * @returns {void}
     */
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

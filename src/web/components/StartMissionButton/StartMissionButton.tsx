import { useState } from "react";

import { StartMissionDialog, DialogActions } from "./StartMissionDialog";
import { DisabledCodes } from "./start-mission-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";

import Bot from "../../data/bots/bot";

import { Command, CommandType } from "../../types/protobuf-types";
import { isCommandAvailable, sendBotCommand } from "../../utils/commands";

import { mdiPlay } from "@mdi/js";
import "../../style/stylesheets/util.less";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { UNASSIGNED_ID } from "../../utils/constants";
import Mission from "../../data/missions/mission";

interface Props {
    bot: Bot;
    mission: Mission;
}

/**
 * Produces the start mission button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StartMissionButton(props: Props) {
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
     */
    const getDisabledCode = () => {
        // Comms check

        if (
            !isCommandAvailable(
                CommandType.START_MISSION,
                props.bot.getMissionStatus().missionState,
            )
        ) {
            return DisabledCodes.MISSION_STATE;
        }

        if (missionsManager.getMissionID(props.bot.getBotID()) === UNASSIGNED_ID) {
            return DisabledCodes.NO_MISSION_ASSIGNED;
        }

        // Download queue check

        // Low battery check

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
            const startMissionCommand: Command = {
                bot_id: props.bot.getBotID(),
                type: CommandType.MISSION_PLAN,
                plan: props.mission.packageMissionForHub(),
            };
            sendBotCommand(startMissionCommand);
        }
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"start-mission-individual-bot"}
                onClick={() => setIsDialogVisible(true)}
            >
                <Icon path={mdiPlay} title="Start Mission" />
            </Button>
            <StartMissionDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
        </div>
    );
}

import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import TakeControlDialog from "../../TakeControlDialog/TakeControlDialog";
import { StartMissionDialog } from "./StartMissionDialog";
import { DisabledCodes } from "./start-mission-messages";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";

import Bot from "../../../data/bots/bot";
import Mission from "../../../data/mission_set/mission";

import { Command, CommandType } from "../../../types/protobuf-types";
import { DialogActions } from "../../../types/context-types";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";

import { mdiPlay } from "@mdi/js";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import {
    MDI_BUTTON_SIZE,
    MIN_BATTERY_PERCENT,
    NO_COMMS_STATUS_AGE,
    UNASSIGNED_ID,
} from "../../../utils/constants";
import { microsecondsToSeconds } from "../../../utils/conversions";

interface Props {
    bot: Bot;
    mission: Mission;
}

/**
 * Produces the start mission button for an individual Bot.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StartMissionButton(props: Props) {
    const jaiaDispatch = useContext(JaiaDispatchContext);
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
     */
    const getDisabledCode = () => {
        if (microsecondsToSeconds(props.bot.getStatusAge()) > NO_COMMS_STATUS_AGE) {
            return DisabledCodes.NO_COMMS;
        }

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

        if (props.bot.getBatteryPercent() < MIN_BATTERY_PERCENT) {
            return DisabledCodes.LOW_BATTERY;
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
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            const startMissionCommand: Command = {
                bot_id: props.bot.getBotID(),
                type: CommandType.MISSION_PLAN,
                plan: props.mission.packageMissionForHub(),
            };
            const response = await sendBotCommand(startMissionCommand);
            if (response && response.status === "ok") {
                jaiaDispatch({ type: JaiaActions.SENT_COMMAND, command: startMissionCommand });
            }
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
                aria-label={"start-mission-individual-bot"}
                onClick={() => onButtonClick()}
            >
                <Icon path={mdiPlay} size={MDI_BUTTON_SIZE} title="Start Mission" />
            </Button>
            <StartMissionDialog
                isVisible={isDialogVisible}
                disabledCode={getDisabledCode()}
                onClose={onDialogClose}
            />
            <TakeControlDialog isVisible={isTakeControlVisible} onClose={onTakeControlClose} />
        </div>
    );
}

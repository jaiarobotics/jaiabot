import { useContext, useState } from "react";
import { JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { StartMissionDialog } from "./StartMissionDialog";
import { DisabledCodes } from "../disabled-codes";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";

import Bot from "../../../data/bots/bot";
import Mission from "../../../data/mission_set/mission";

import { Command, Command_CommandType } from "../../../shared/proto/jaiabot/messages/jaia_dccl";
import { MissionPlan } from "../../../shared/proto/jaiabot/messages/mission";
import { DialogActions } from "../../../types/context-types";
import { isCommandAvailable, isControllingClient, sendBotCommand } from "../../../utils/commands";

import { mdiPlay } from "@mdi/js";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { MDI_BUTTON_SIZE, MIN_BATTERY_PERCENT, UNASSIGNED_ID } from "../../../utils/constants";

interface Props {
    bot: Bot;
    mission: Mission;
    missionSetName: string;
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
        if (props.bot.isCommsDropped()) {
            return DisabledCodes.NO_COMMS;
        }

        if (
            !isCommandAvailable(
                Command_CommandType.START_MISSION,
                props.bot.getMissionStatus().missionState,
            )
        ) {
            return DisabledCodes.MISSION_STATE;
        }

        if (missionsManager.getMissionID(props.bot.getBotID()) === UNASSIGNED_ID) {
            return DisabledCodes.NO_MISSION;
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
    const handleClick = () => {
        const hasControl = isControllingClient();

        if (!hasControl && getDisabledCode() === DisabledCodes.NONE) {
            setIsTakeControlVisible(true);
        } else {
            setIsDialogVisible(true);
        }
    };

    /**
     * Sends a mission plan to the bot
     *
     * @param {MissionPlan} plan The mission plan to send
     * @returns {void}
     */
    const sendPlan = async (plan: MissionPlan) => {
        const startMissionCommand: Command = {
            bot_id: props.bot.getBotID(),
            type: Command_CommandType.MISSION_PLAN,
            plan,
        };
        const response = await sendBotCommand(startMissionCommand);
        if (response && response.status === "ok") {
            jaiaDispatch({ type: JaiaActions.SENT_COMMAND, command: startMissionCommand });
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
        if (dialogAction !== DialogActions.CONFIRMED) return;
        const missionPlan = props.mission.packageMissionForHub(props.missionSetName);
        await sendPlan(missionPlan);
    };

    return (
        <div>
            <Button
                className={getClassName()}
                aria-label={"start-mission-individual-bot"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiPlay} size={MDI_BUTTON_SIZE} title="Start Mission" />
            </Button>
            <StartMissionDialog
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

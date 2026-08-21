import { useContext, useState } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { StartMissionDialog } from "./StartMissionDialog";
import { DisabledCodes } from "../disabled-codes";
import { getMissionDisabledCode } from "../button-utils";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";

import Bot from "../../../data/bots/bot";
import Mission from "../../../data/mission_set/mission";

import { Command, CommandType, MissionPlan } from "../../../types/protobuf-types";
import { DialogActions } from "../../../types/context-types";
import { isControllingClient, sendBotCommand } from "../../../utils/commands";

import { mdiPlay } from "@mdi/js";
import { missionsManager } from "../../../data/missions_manager/missions-manager";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";

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
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    if (jaiaContext === null) {
        return <div></div>;
    }

    const missionID = missionsManager.getMissionID(props.bot.getBotID());
    const prediction = jaiaContext.batteryPredictions.getStatus(missionID)?.prediction ?? null;
    const disabledCode = getMissionDisabledCode(props.bot, missionID, prediction);

    /**
     * Forms the style of the button (light if enabled, dark if disabled).
     * LOW_BATTERY and INSUFFICIENT_BATTERY are overridable warnings rather than hard
     * blocks (the dialog still lets the operator confirm and start the mission), so the
     * button stays active-looking for those codes to match its actual behavior.
     *
     * @returns {string} General class name jaia-button plus enable/disable factor
     */
    const getClassName = () => {
        let className = "jaia-button";

        if (
            disabledCode !== DisabledCodes.NONE &&
            disabledCode !== DisabledCodes.LOW_BATTERY &&
            disabledCode !== DisabledCodes.INSUFFICIENT_BATTERY
        ) {
            className += " disabled";
        }

        return className;
    };

    /**
     * Determines what dialog to display (take control or activate)
     *
     * @returns {void}
     */
    const handleClick = () => {
        const hasControl = isControllingClient();

        if (!hasControl && disabledCode === DisabledCodes.NONE) {
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
            type: CommandType.MISSION_PLAN,
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
                disabledCode={disabledCode}
                batteryPrediction={prediction}
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

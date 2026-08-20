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
import {
    BatteryPrediction,
    fetchBatteryPrediction,
} from "../../../data/battery_predictions/battery-prediction-calculator";

import { Command, CommandType, MissionPlan } from "../../../types/protobuf-types";
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
    const [batteryPrediction, setBatteryPrediction] = useState<BatteryPrediction | null>(null);

    const missionID = missionsManager.getMissionID(props.bot.getBotID());

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
     * @param {BatteryPrediction | null} [prediction] Battery prediction to check against; defaults to
     *   the current state, but callers acting on a just-fetched prediction should pass it explicitly
     *   since the state setter hasn't taken effect yet at that point
     * @returns {DisabledCodes} The applicable disabled code based on the Bot and button conditions
     */
    const getDisabledCode = (prediction: BatteryPrediction | null = batteryPrediction) => {
        if (props.bot.isCommsDropped()) {
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

        if (missionID === UNASSIGNED_ID) {
            return DisabledCodes.NO_MISSION;
        }

        // Download queue check

        if (props.bot.getBatteryPercent() < MIN_BATTERY_PERCENT) {
            return DisabledCodes.LOW_BATTERY;
        }

        // A null prediction (unsupported bot type, no waypoints, request failure, etc.)
        // intentionally does not block starting the mission -- the battery check is
        // advisory, not a safety gate, so we fail open when we have no prediction to check.
        if (prediction !== null && prediction.predicted_final_pct < MIN_BATTERY_PERCENT) {
            return DisabledCodes.INSUFFICIENT_BATTERY;
        }

        return DisabledCodes.NONE;
    };

    /**
     * Fetches a fresh battery prediction, then determines what dialog to display
     * (take control or activate). Fetched fresh on every click rather than reading the
     * periodically-updated cache, since this is the moment a command is actually about
     * to be sent -- a stale "safe to start" read here is worse than the brief pause.
     *
     * @returns {void}
     */
    const handleClick = async () => {
        const hasControl = isControllingClient();

        const prediction = await fetchBatteryPrediction(props.mission, props.bot);
        setBatteryPrediction(prediction);

        if (!hasControl && getDisabledCode(prediction) === DisabledCodes.NONE) {
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
                disabledCode={getDisabledCode()}
                batteryPrediction={batteryPrediction}
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

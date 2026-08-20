import { useContext, useState } from "react";
import { JaiaContext, JaiaDispatchContext } from "../../../context/JaiaContext";
import { JaiaActions } from "../../../context/jaia-actions";

import TakeControlDialog from "../TakeControl/TakeControlDialog/TakeControlDialog";
import { StartAllMissionsDialog } from "./StartAllMissionsDialog";
import { DisabledCodes } from "../disabled-codes";
import { getMissionDisabledCode } from "../button-utils";

import { Icon } from "@mdi/react";
import { Button } from "@mui/material";
import { mdiPlay } from "@mdi/js";

import Bot from "../../../data/bots/bot";
import Mission from "../../../data/mission_set/mission";

import { missionsManager } from "../../../data/missions_manager/missions-manager";

import { Command, CommandType } from "../../../types/protobuf-types";
import { ButtonNames, ButtonTypes, DialogActions } from "../../../types/context-types";
import { isControllingClient, sendBotCommand } from "../../../utils/commands";
import { MDI_BUTTON_SIZE } from "../../../utils/constants";

interface Props {
    bots: Map<number, Bot>;
    missions: Map<number, Mission>;
    missionSetName: string;
}

type DisabledCodeGroup = [DisabledCodes, number[]];

/**
 * Produces the button to start all missions.
 * It manages the alert/confirm dialog that appears when clicking on the button.
 */
export default function StartAllMissionsButton(props: Props) {
    const jaiaContext = useContext(JaiaContext);
    const jaiaDispatch = useContext(JaiaDispatchContext);
    const [isDialogVisible, setIsDialogVisible] = useState(false);
    const [botReadyStates, setBotReadyStates] = useState(
        new Map<DisabledCodes, number[]>(initBotReadyStates()),
    );
    const [isTakeControlVisible, setIsTakeControlVisible] = useState(false);

    /**
     * Loops through the connected Bots and categorizes them based on their readiness to
     * start a mission, reading each Bot's battery prediction from the shared context cache
     * so this dialog can never disagree with the rest of the app about a mission's status.
     *
     * @returns {void}
     */
    const groupBotsByReadyState = () => {
        const updatedBotReadyStates = new Map<DisabledCodes, number[]>(initBotReadyStates());

        for (const [botID, bot] of props.bots) {
            const missionID = missionsManager.getMissionID(botID);
            const prediction =
                jaiaContext.batteryPredictions.getStatus(missionID)?.prediction ?? null;
            const disabledCode = getMissionDisabledCode(bot, missionID, prediction);
            updatedBotReadyStates.get(disabledCode).push(botID);
        }

        setBotReadyStates(updatedBotReadyStates);
    };

    /**
     * Triggers the state to open the alert/confirm dialog box with the Bots
     * categorized to produce the correct alert/confirm message
     *
     * @returns {void}
     */
    const handleClick = () => {
        if (props.bots.size === 0) {
            return;
        }

        const hasControl = isControllingClient();

        if (!hasControl) {
            setIsTakeControlVisible(true);
        } else {
            groupBotsByReadyState();
            setIsDialogVisible(true);
            jaiaDispatch({
                type: JaiaActions.CLICKED_BUTTON,
                buttonType: ButtonTypes.COMMAND,
                buttonName: ButtonNames.START_ALL_MISSIONS,
            });
        }
    };

    /**
     * Closes the dialog box and follows up on the operator's action
     *
     * @param {DialogActions} dialogAction The operators action on the dialog box
     * @returns {void}
     */
    const onDialogClose = async (dialogAction: DialogActions) => {
        setIsDialogVisible(false);

        if (dialogAction === DialogActions.CONFIRMED) {
            for (const botID of botReadyStates.get(DisabledCodes.NONE)) {
                const missionID = missionsManager.getMissionID(botID);
                const missionPlan = props.missions
                    .get(missionID)
                    .packageMissionForHub(props.missionSetName);

                const startMissionCommand: Command = {
                    bot_id: botID,
                    type: CommandType.MISSION_PLAN,
                    plan: missionPlan,
                };
                const res = await sendBotCommand(startMissionCommand);
                if (res.status === "ok") {
                    jaiaDispatch({ type: JaiaActions.SENT_COMMAND, command: startMissionCommand });
                }
            }
        }
    };

    return (
        <div>
            <Button
                className={"jaia-button"}
                aria-label={"start-all-missions"}
                onClick={() => handleClick()}
            >
                <Icon path={mdiPlay} size={MDI_BUTTON_SIZE} title="Start All Missions" />
            </Button>
            <StartAllMissionsDialog
                isVisible={isDialogVisible}
                botReadyStates={botReadyStates}
                numBots={props.bots.size}
                onClose={onDialogClose}
            />
            <TakeControlDialog
                isVisible={isTakeControlVisible}
                setIsTakeControlVisible={setIsTakeControlVisible}
                setIsDialogVisible={setIsDialogVisible}
                groupBotsByReadyState={groupBotsByReadyState}
            />
        </div>
    );
}

/**
 * Maps each disabled code to an empty array to prevent undefined behavior
 *
 * @returns {Map<DisabledCodes, number[]>} Disabled codes mapped to an empty array for Bot IDs
 */
function initBotReadyStates() {
    const botReadyStates: DisabledCodeGroup[] = [
        [DisabledCodes.NONE, []],
        [DisabledCodes.NO_COMMS, []],
        [DisabledCodes.MISSION_STATE, []],
        [DisabledCodes.NO_MISSION, []],
        [DisabledCodes.DOWNLOAD_QUEUE, []],
        [DisabledCodes.LOW_BATTERY, []],
        [DisabledCodes.INSUFFICIENT_BATTERY, []],
    ];
    return botReadyStates;
}

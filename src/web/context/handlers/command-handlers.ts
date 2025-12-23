import { bots } from "../../data/bots/bots";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { BotModes } from "../../types/jaia-system-types";
import { JaiaContextType, JaiaAction } from "../../types/context-types";
import { Command, CommandType, MovementType } from "../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../utils/constants";

/**
 * Sets the mode of the Bot based on the command sent
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {JaiaAction} action including command of Command sent to Bot
 * @returns {JaiaContextType} Updated mutable state object
 */
export function handleSentCommand(mutableState: JaiaContextType, action: JaiaAction) {
    const bot = bots.getBot(action.command.bot_id);

    switch (action.command.type) {
        case CommandType.MISSION_PLAN:
            handleSentMissionPlanCommand(mutableState, action.command);
            break;
        case CommandType.REMOTE_CONTROL_TASK:
            bot.setMode(BotModes.REMOTE_CONTROL);
            break;
        default:
            bot.setMode(BotModes.MISSION);
    }
    return mutableState;
}

/**
 * Sets the mode of the Bot and turns off edit mode for the mission underway
 *
 * @param {JaiaContextType} mutableState State object ref for making modifications
 * @param {Command} command Provides access to the Bot and movement type
 * @returns {void}
 */
function handleSentMissionPlanCommand(mutableState: JaiaContextType, command: Command) {
    const bot = bots.getBot(command.bot_id);
    const movement = command.plan.movement;
    if (movement === MovementType.TRANSIT) {
        bot.setMode(BotModes.MISSION);
    } else if (movement === MovementType.REMOTE_CONTROL) {
        bot.setMode(BotModes.REMOTE_CONTROL);
    }

    const missionID = missionsManager.getMissionID(bot.getBotID());
    if (missionSet.getMissionIDInEditMode() === missionID) {
        missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
    }
    missionSet.deleteGhostMission(missionID);
    console.log(missionSet.getGhostMissions());
}

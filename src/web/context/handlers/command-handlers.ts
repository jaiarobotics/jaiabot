import { bots } from "../../data/bots/bots";
import { missionSet } from "../../data/mission_set/mission-set";
import { missionsManager } from "../../data/missions_manager/missions-manager";
import { BotModes } from "../../types/jaia-system-types";
import { JaiaContextType, JaiaAction } from "../../types/context-types";
import { Command, Command_CommandType } from "../../shared/proto/jaiabot/messages/jaia_dccl";
import { MissionPlan_MovementType } from "../../shared/proto/jaiabot/messages/mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { ghostMissionLayer } from "../../openlayers/layers/vector/mission-layer";

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
        case Command_CommandType.MISSION_PLAN:
            handleSentMissionPlanCommand(mutableState, action.command);
            break;
        case Command_CommandType.REMOTE_CONTROL_TASK:
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
    if (movement === MissionPlan_MovementType.TRANSIT) {
        bot.setMode(BotModes.MISSION);
    } else if (movement === MissionPlan_MovementType.REMOTE_CONTROL) {
        bot.setMode(BotModes.REMOTE_CONTROL);
    }

    const missionID = missionsManager.getMissionID(bot.getBotID());
    if (missionSet.getMissionIDInEditMode() === missionID) {
        missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
    }

    manageGhostLayer(command.bot_id, missionID);
}

/**
 * Loops through the missions to update the ghost parameters
 *
 * @param {number} botID Used to reset ghost mission params
 * @param {number} missionID Used to delete the ghost mission
 * @returns {void}
 */
function manageGhostLayer(botID: number, missionID: number) {
    if (!missionSet.getMission(missionID)) {
        return;
    }

    for (const mission of missionSet.getMissions().values()) {
        // Reset ghost parameters on previously assigned mission
        if (mission.getGhostParameters().botID === botID) {
            mission.resetGhostParameters();
        }
    }

    for (const mission of missionSet.getGhostMissions().values()) {
        // Bot started new mission, remove ghost mission
        if (mission.getGhostParameters().botID === botID) {
            missionSet.deleteGhostMission(mission.getMissionID());
        }
    }

    missionSet.getMission(missionID).setGhostParameters({
        hasStarted: true,
        botID: botID,
        repeats: missionSet.getMission(missionID).getRepeats(),
    });
    missionSet.addGhostMission(missionID);
    ghostMissionLayer.updateFeatures();
}

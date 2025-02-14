import { bots } from "../bots/bots";
import { missions } from "../missions/missions";
import { convertMicrosecondsToSeconds } from "../../shared/Utilities";

class MissionsManager {
    private botsToMissions: Map<number, number>;
    private missionsToBots: Map<number, number>;

    readonly UNASSIGNED_ID = -1;
    readonly STATUS_AGE_MAX_SECONDS = 30;

    constructor() {
        this.botsToMissions = new Map<number, number>();
        this.missionsToBots = new Map<number, number>();
    }

    /**
     * Provides the mission ID associated with a Bot
     *
     * @param {number} botID Used in search for mission assoicated with Bot
     * @returns {number} Mission ID associated with a Bot or (-1) if the Bot is not assigned to a mission
     */
    getMissionID(botID: number) {
        return this.botsToMissions.get(botID) ?? this.UNASSIGNED_ID;
    }

    /**
     * Provides the Bot ID associated with a mission
     *
     * @param {number} missionID Used in search for Bot associated with mission
     * @returns {number} Bot ID associated with a mission or (-1) if the mission is not assigned to a Bot
     */
    getBotID(missionID: number) {
        return this.missionsToBots.get(missionID) ?? this.UNASSIGNED_ID;
    }

    /**
     * Connects Bots and missions
     *
     * @param {number} botID Used in assignment
     * @param {number} missionID Used in assignment
     * @returns {void}
     */
    assign(botID: number, missionID: number) {
        // Reset Bot previously assigned to mission
        const previousBotAssignment = this.getBotID(missionID);

        if (previousBotAssignment !== this.UNASSIGNED_ID) {
            this.botsToMissions.set(previousBotAssignment, this.UNASSIGNED_ID);
        }

        // We do not need a key of (-1) in the botsToMissions map
        if (botID !== this.UNASSIGNED_ID) {
            this.botsToMissions.set(botID, missionID);
        }

        this.missionsToBots.set(missionID, botID);
    }

    /**
     * Assigns available Bots to open missions. The Bot and mission assignments move from low IDs to high IDs
     *
     * @returns {void}
     */
    autoAssign() {
        for (let [missionID, mission] of missions.getMissions()) {
            if (this.getBotID(mission.getMissionID()) === this.UNASSIGNED_ID) {
                if (this.getNextAvailableBotID() !== this.UNASSIGNED_ID) {
                    this.assign(this.getNextAvailableBotID(), mission.getMissionID());
                }
            }
        }
    }

    /**
     * Finds the lowest Bot ID that is not assigned to a mission
     *
     * @returns {number} Bot ID or (-1) if all Bots are already assigned to missions or outside of comms range
     */
    getNextAvailableBotID() {
        for (let [botID, bot] of bots.getBots()) {
            if (
                this.getMissionID(bot.getBotID()) === this.UNASSIGNED_ID &&
                convertMicrosecondsToSeconds(bot.getStatusAge()) < this.STATUS_AGE_MAX_SECONDS
            ) {
                return bot.getBotID();
            }
        }
        return this.UNASSIGNED_ID;
    }

    /**
     * Removes connection between a Bot and a deleted mission
     *
     * @param {number} missionID ID of deleted mission
     * @returns {void}
     */
    removeAssignment(missionID: number) {
        const botAssignment = this.getBotID(missionID);

        if (botAssignment !== this.UNASSIGNED_ID) {
            this.botsToMissions.set(botAssignment, this.UNASSIGNED_ID);
        }
    }

    /**
     * Resets the Bot and mission connections
     *
     * @returns {void}
     */
    clear() {
        this.botsToMissions.clear();
        this.missionsToBots.clear();
    }
}

export const missionsManager = new MissionsManager();

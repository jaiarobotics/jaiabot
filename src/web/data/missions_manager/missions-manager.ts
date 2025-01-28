class MissionsManager {
    private botsToMissions: Map<number, number>;
    private missionsToBots: Map<number, number>;

    readonly UNASSIGNED_ID = -1;

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

import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { Speeds, GeographicCoordinate } from "../../types/protobuf-types";

class MissionSet {
    private missions: Map<number, Mission>;
    private nextMissionID: number;
    private missionIDInEditMode: number;
    private missionSpeeds: Speeds;
    private name: string;

    constructor() {
        this.missions = new Map<number, Mission>();
        this.nextMissionID = 1;
        this.missionIDInEditMode = UNASSIGNED_ID;
        this.missionSpeeds = { transit: 2, stationkeep_outer: 2 };
    }

    getMissions() {
        return this.missions;
    }

    setMissions(missions: Map<number, Mission>) {
        this.missions = missions;
    }

    getNextMissionID() {
        return this.nextMissionID;
    }

    setNextMissionID(nextMissionID: number) {
        this.nextMissionID = nextMissionID;
    }

    setName(name: string) {
        this.name = name;
    }

    getName() {
        return this.name;
    }

    getMission(missionNum: number) {
        return this.missions.get(missionNum);
    }

    getMissionIDInEditMode() {
        return this.missionIDInEditMode;
    }

    setMissionIDInEditMode(missionIDInEditMode: number) {
        this.missionIDInEditMode = missionIDInEditMode;
    }

    getMissionSpeeds() {
        return this.missionSpeeds;
    }

    setMissionSpeeds(missionSpeeds: Speeds) {
        this.missionSpeeds = { ...missionSpeeds };

        for (const [missionID, mission] of this.missions.entries()) {
            mission.setSpeeds(this.missionSpeeds);
        }
    }

    addMission(mission: Mission) {
        const missionID = this.getNextMissionID();
        this.missions.set(missionID, mission);
        mission.setMissionID(missionID);
        this.setMissionIDInEditMode(missionID);
        this.setNextMissionID(this.getNextMissionID() + 1);
        return missionID;
    }

    addMissions(missions: Mission[]) {
        for (let mission of missions) {
            this.addMission(mission);
        }
    }

    deleteMission(missionID: number) {
        this.missions.delete(missionID);

        if (missionID === this.getMissionIDInEditMode()) {
            this.setMissionIDInEditMode(UNASSIGNED_ID);
        }
    }

    deleteAllMissions() {
        this.missions.clear();
        this.setMissionIDInEditMode(UNASSIGNED_ID);
        this.setNextMissionID(1);
    }

    /**
     * Saves an individual mission to local storage
     *
     * @param {string} name Name to use when storing mission in local storage
     * @param {number} missionID Mission ID of mission to be saved
     *
     * @notes not used at this time, provided for future capabilities
     */
    saveMission(name: string, missionID: number) {
        const mission = this.getMission(missionID);
        // Save name for later correlation
        mission.setName(name);
        localStorage.setItem(name, JSON.stringify(mission));
    }

    /**
     * Adds a mission to the mission set from local storage
     *
     * @param {string} name Name of save mission to load from local storage
     *
     * @notes not used at this time, provided for future capabilities
     */
    loadMission(name: string) {
        const jsonMission = localStorage.getItem(name);
        if (!jsonMission) throw new Error("No mission found in storage");

        const newMission = Mission.fromJSON(JSON.parse(jsonMission));
        // Save to the mission set
        this.addMission(newMission);
    }

    /**
     * Saves all the current missions as a mission set to local storage
     *
     * @param {string} name : Name to use for storing the mission set
     */
    saveMissionSet(name: string) {
        // Apply the name to the mission set and all the missions
        this.setName(name);
        this.missions.forEach((mission) => {
            mission.setName(name);
        });
        // Convert missions Map to an array before using stringify
        const missionsArray = Array.from(this.missions.entries());
        // Read the saved mission sets from localStorage (or start fresh)
        const existing = JSON.parse(localStorage.getItem("missionSets") || "{}");

        // Save this mission set
        existing[name] = {
            missions: missionsArray,
            nextMissionID: this.nextMissionID,
            missionIDInEditMode: this.missionIDInEditMode,
            missionSpeeds: this.missionSpeeds,
            name: this.name,
        };

        localStorage.setItem("missionSets", JSON.stringify(existing));
    }

    /**
     * Replaces the current mission set with those from a saved set
     *
     * @param {string} name String Name of saved set to retrieve
     * @returns {boolean} False if the mission set was not found
     */
    loadMissionSet(name: string) {
        // Get all saved mission sets
        const allSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
        const data = allSets[name];

        if (!data) return false;

        // Clear current mission set and reset state
        this.deleteAllMissions();

        // Rebuild mission set from saved entries
        if (Array.isArray(data.missions)) {
            data.missions.forEach(([id, missionObj]: [number, any]) => {
                const mission = Mission.fromJSON(missionObj);
                this.addMission(mission);
            });
        }

        // Restore other fields
        this.missionSpeeds = data.missionSpeeds;
        this.name = data.name;
        return true;
    }

    /**
     * Returns an array of all saved mission set names in localStorage, sorted alphabetically.
     */
    listSavedMissionSets(): string[] {
        const all = JSON.parse(localStorage.getItem("missionSets") || "{}");
        return Object.keys(all).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Deletes a saved mission set from localStorage by name.
     *
     * @param {string} name : string name of the mission set to delete
     * @returns {boolean} False if the mission set was not found
     */
    deleteMissionSet(name: string) {
        const all = JSON.parse(localStorage.getItem("missionSets") || "{}");

        if (!(name in all)) {
            return false;
        }

        delete all[name];

        localStorage.setItem("missionSets", JSON.stringify(all));
        return true;
    }
}

export const missionSet = new MissionSet();

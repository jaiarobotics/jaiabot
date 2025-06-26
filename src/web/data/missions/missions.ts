import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { Speeds, GeographicCoordinate } from "../../types/protobuf-types";

class Missions {
    private missions: Map<number, Mission>;
    private nextMissionID: number;
    private missionIDInEditMode: number;
    private missionSpeeds: Speeds;
    private saveName: string;

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

    setSaveName(saveName: string) {
        this.saveName = saveName;
    }

    getSaveName() {
        return this.saveName;
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

    addMissionSet(missions: Mission[]) {
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
     * Saves a mission to local storage
     *
     * @param saveName Name to use when storing mission in local storage
     * @param missionID Mission ID of mission to be saved
     */
    saveMission(saveName: string, missionID: number) {
        const mission = this.getMission(missionID);
        // Save saveName for later correlation
        mission.setSaveName(saveName);
        localStorage.setItem(saveName, JSON.stringify(mission));
    }

    /**
     * Adds a mission to the missions singleton from local storage
     *
     * @param saveName Name of save mission to load from local storage
     */
    loadMission(saveName: string) {
        const jsonMission = localStorage.getItem(saveName);
        if (!jsonMission) throw new Error("No mission found in storage");

        const newMission = Mission.fromJSON(JSON.parse(jsonMission));
        // Save to the missions singleton
        this.addMission(newMission);
    }

    /**
     * Saves all the current missions as a mission set to local storage
     *
     * @param saveName : string name to use for storing the mission set
     */
    saveMissionSet(saveName: string) {
        // Apply the saveName to the mission set and all the missions
        missions.setSaveName(saveName);
        missions.missions.forEach((mission) => {
            mission.setSaveName(saveName);
        });
        // Convert missions Map to an array before using stringify
        const missionsArray = Array.from(missions.missions.entries());
        // Read the current missionSets (or start fresh)
        const existing = JSON.parse(localStorage.getItem("missionSets") || "{}");

        // Save this mission set
        existing[saveName] = {
            missions: missionsArray,
            nextMissionID: this.nextMissionID,
            missionIDInEditMode: this.missionIDInEditMode,
            missionSpeeds: this.missionSpeeds,
            saveName: this.saveName,
        };

        localStorage.setItem("missionSets", JSON.stringify(existing));
    }

    /**
     * Replaces all current missions with those from a save set
     *
     * @param saveName : string Name of saved set to retrieve
     * @returns boolean : False if the mission set was not found
     */
    loadMissionSet(saveName: string) {
        // Get all saved mission sets
        const allSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
        const data = allSets[saveName];

        if (!data) return false;

        // Clear current missions map and reset state
        this.deleteAllMissions();

        // Rebuild missions Map from saved entries
        if (Array.isArray(data.missions)) {
            data.missions.forEach(([id, missionObj]: [number, any]) => {
                const mission = Mission.fromJSON(missionObj);
                this.addMission(mission);
            });
        }

        // Restore other fields
        this.missionSpeeds = data.missionSpeeds;
        this.saveName = data.saveName;
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
     * @param saveName : string name of the mission set to delete
     * @returns boolean : False if the mission set was not found
     */
    deleteMissionSet(saveName: string) {
        const all = JSON.parse(localStorage.getItem("missionSets") || "{}");

        if (!(saveName in all)) {
            return false;
        }

        delete all[saveName];

        localStorage.setItem("missionSets", JSON.stringify(all));
        return true;
    }
}

export const missions = new Missions();

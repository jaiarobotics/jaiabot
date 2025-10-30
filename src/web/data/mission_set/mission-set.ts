import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { Speeds } from "../../types/protobuf-types";

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
        this.name = "";
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
     * Saves all the current missions as a mission set to local storage
     *
     * @param {string} name Name to use for storing the mission set
     * @returns {void}
     */
    saveToLocalStorage(name: string) {
        this.setName(name);
        // Read the saved mission sets from localStorage (or start fresh)
        const missionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
        // Convert missions map to an array before using stringify
        const missionsArray = Array.from(this.missions.entries());

        missionSets[name] = {
            missions: missionsArray,
            nextMissionID: this.nextMissionID,
            missionIDInEditMode: this.missionIDInEditMode,
            missionSpeeds: this.missionSpeeds,
            name: this.name,
        };

        localStorage.setItem("missionSets", JSON.stringify(missionSets));
    }

    /**
     * Replaces the current mission set with those from a saved set
     *
     * @param {string} name Identifies the mission set to retrieve
     * @returns {boolean} False if the mission set was not found
     */
    loadFromLocalStorage(name: string) {
        const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");
        const targetMissionSet = allMissionSets[name];

        if (!targetMissionSet) return false;

        // Clear current mission set and reset state
        this.deleteAllMissions();

        // Rebuild mission set from saved entries
        if (Array.isArray(targetMissionSet.missions)) {
            targetMissionSet.missions.forEach(([id, missionJSON]: [number, string]) => {
                const mission = Mission.fromJSON(missionJSON);
                this.addMission(mission);
            });
        }
        this.missionIDInEditMode = UNASSIGNED_ID;
        this.missionSpeeds = targetMissionSet.missionSpeeds;
        this.name = targetMissionSet.name;
        return true;
    }

    /**
     * Deletes a saved mission set from localStorage
     *
     * @param {string} name Identifies the mission set to delete
     * @returns {boolean} False if the mission set was not found
     */
    deleteFromLocalStorage(name: string) {
        const allMissionSets = JSON.parse(localStorage.getItem("missionSets") || "{}");

        if (!(name in allMissionSets)) {
            return false;
        }

        delete allMissionSets[name];

        localStorage.setItem("missionSets", JSON.stringify(allMissionSets));
        return true;
    }
}

export const missionSet = new MissionSet();

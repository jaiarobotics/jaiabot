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
    saveAllMissions(saveName: string) {
        // Apply the saveName to the mission set and all the missions
        missions.setSaveName(saveName);
        missions.missions.forEach((mission) => {
            mission.setSaveName(saveName);
        });
        // Convert missions Map to an array before using stringify
        const missionsArray = Array.from(missions.missions.entries());
        localStorage.setItem(
            saveName,
            JSON.stringify({
                missions: missionsArray,
                nextMissionID: missions.nextMissionID,
                missionIDInEditMode: missions.missionIDInEditMode,
                missionSpeeds: missions.missionSpeeds,
                saveName: missions.saveName,
            }),
        );
    }

    /**
     * Replaces all current missions with those from a save set
     *
     * @param saveName : string Name of saved set to retrieve
     *
     */
    loadAllMissions(saveName: string) {
        const json = localStorage.getItem(saveName);
        if (!json) throw new Error("No saved missions found");

        const data = JSON.parse(json);

        // Clear current missions map
        this.deleteAllMissions();

        // Rebuild missions Map from saved entries
        if (data.missions && Array.isArray(data.missions)) {
            data.missions.forEach(([id, missionObj]: [number, any]) => {
                // Use your Mission.fromJSON to rehydrate each mission
                const mission = Mission.fromJSON(missionObj);
                this.addMission(mission);
            });
        }

        // Restore other fields
        this.missionSpeeds = data.missionSpeeds;
        this.saveName = data.saveName;
    }
}

export const missions = new Missions();

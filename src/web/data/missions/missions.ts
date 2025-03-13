import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";

class Missions {
    private missions: Map<number, Mission>;
    private nextMissionID: number;
    private missionIDInEditMode: number;

    constructor() {
        this.missions = new Map<number, Mission>();
        this.nextMissionID = 1;
        this.missionIDInEditMode = UNASSIGNED_ID;
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

    getMission(missionNum: number) {
        return this.missions.get(missionNum);
    }

    getMissionIDInEditMode() {
        return this.missionIDInEditMode;
    }

    setMissionIDInEditMode(missionIDInEditMode: number) {
        this.missionIDInEditMode = missionIDInEditMode;
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
}

export const missions = new Missions();

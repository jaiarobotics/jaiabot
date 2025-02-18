import Mission from "./mission";
import { NO_MISSION_ID } from "../../utils/constants";

class Missions {
    private missions: Map<number, Mission>;
    private missionID: number;
    private nextMissionID: number;
    private missionIDInEditMode: number;

    constructor() {
        this.missions = new Map<number, Mission>();
        this.nextMissionID = 1;
        this.missionIDInEditMode = NO_MISSION_ID;
    }

    getMissions() {
        return this.missions;
    }

    setMissions(missions: Map<number, Mission>) {
        this.missions = missions;
    }

    getMissionID() {
        return this.missionID;
    }

    setMissionID(missionID: number) {
        this.missionID = missionID;
    }

    getNextMissionID() {
        return this.nextMissionID;
    }

    setNextMissionID(nextMissionID: number) {
        this.nextMissionID = nextMissionID;
    }

    getMission(missionNum: number) {
        return this.getMissions().get(missionNum);
    }

    getMissionIDInEditMode() {
        return this.missionIDInEditMode;
    }

    setMissionIDInEditMode(missionIDInEditMode: number) {
        this.missionIDInEditMode = missionIDInEditMode;
    }

    addMission(mission: Mission) {
        const missionID = this.getNextMissionID();
        this.getMissions().set(missionID, mission);
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
        this.getMissions().delete(missionID);

        if (missionID === this.getMissionIDInEditMode()) {
            this.setMissionIDInEditMode(NO_MISSION_ID);
        }
    }

    deleteAllMissions() {
        this.getMissions().clear();
        this.setMissionIDInEditMode(NO_MISSION_ID);
        this.setNextMissionID(1);
    }
}

export const missions = new Missions();

import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";

class Missions {
    private missions: Map<number, Mission>;
    private nextMissionID: number;

    constructor() {
        this.missions = new Map<number, Mission>();
        this.nextMissionID = 1;
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
        return this.getMissions().get(missionNum);
    }

    addMission(mission: Mission) {
        const missionID = this.getNextMissionID();
        this.getMissions().set(missionID, mission);
        mission.setMissionID(missionID);
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
        // TODO Make sure missionIDInEditMode is update in GlobalContext
        /*if (missionID === this.getMissionIDInEditMode()) {
            this.setMissionIDInEditMode(UNASSIGNED_ID);
        } */
    }

    deleteAllMissions() {
        this.getMissions().clear();
        // TODO Make sure missionIDInEditMode is update in GlobalContext
        //this.setMissionIDInEditMode(UNASSIGNED_ID);
        this.setNextMissionID(1);
    }
}

export const missions = new Missions();

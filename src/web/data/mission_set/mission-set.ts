import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { Speeds } from "../../types/protobuf-types";
import { missionsManager } from "../missions_manager/missions-manager";

export interface MissionSetSnapshot {
    missions: Mission[];
    nextMissionID: number;
    missionIDInEditMode: number | null;
    missionSpeeds: Speeds;
    name: string;
}

export class MissionSet {
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
     * Captures a snapshot of the current missionSet
     *
     * @returns {object} snapshot of current missionSet data
     */
    captureMissionSetSnapshot() {
        const currentMissionSet = {
            missions: Array.from(missionSet.getMissions().values()),
            nextMissionID: missionSet.getNextMissionID(),
            missionIDInEditMode: missionSet.getMissionIDInEditMode(),
            missionSpeeds: missionSet.getMissionSpeeds(),
            name: missionSet.getName(),
        };
        return currentMissionSet;
    }

    /**
     * Replaces the current mission set with one from a saved snapshot
     *
     * @param {MissionSetSnapshot} missionSetSnapshot Snapshot of mission set
     * @returns {void}
     *
     * @notes
     * This is called by the reducer/action handler
     */

    restoreMissionSetFromSnapshot(missionSetSnapshot: MissionSetSnapshot) {
        // Clear current mission set and reset mission assignments
        missionSet.deleteAllMissions();
        missionsManager.unassignAll();

        // Rebuild mission set from snapshot
        if (Array.isArray(missionSetSnapshot.missions)) {
            missionSetSnapshot.missions.forEach((mission) => {
                missionSet.addMission(mission);
            });
        }

        missionSet.setName(missionSetSnapshot.name);
        missionSet.setMissionIDInEditMode(UNASSIGNED_ID);
        missionSet.setMissionSpeeds(missionSetSnapshot.missionSpeeds);
    }
}

export const missionSet = new MissionSet();

import cloneDeep from "lodash/cloneDeep";
import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { Speeds } from "../../types/protobuf-types";

export interface MissionSetSnapshot {
    missions: [number, Mission][];
    nextMissionID: number;
    missionIDInEditMode: number;
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
        mission.setSpeeds(this.missionSpeeds);
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
     * Captures a snapshot of the MissionSet
     *
     * @returns {MissionSetSnapshot} snapshot of the MissionSet
     */
    captureSnapshot() {
        const currentMissionSet: MissionSetSnapshot = {
            missions: Array.from(this.missions),
            nextMissionID: this.nextMissionID,
            missionIDInEditMode: this.missionIDInEditMode,
            missionSpeeds: this.missionSpeeds,
            name: this.name,
        };
        return cloneDeep(currentMissionSet);
    }

    /**
     * Replaces the current properties with those from the saved snapshot
     *
     * @param {MissionSetSnapshot} snapshot Snapshot of MissionSet
     * @returns {void}
     */
    restoreFromSnapshot(snapshot: MissionSetSnapshot) {
        // Clear current mission set
        this.deleteAllMissions();

        // Rebuild mission set from snapshot
        if (Array.isArray(snapshot.missions)) {
            snapshot.missions.forEach(([id, mission]) => {
                this.missions.set(id, mission);
            });
        }
        this.nextMissionID = snapshot.nextMissionID;
        this.missionIDInEditMode = snapshot.missionIDInEditMode;
        this.missionSpeeds = snapshot.missionSpeeds;
        this.name = snapshot.name;
    }
}

export const missionSet = new MissionSet();

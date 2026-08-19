import cloneDeep from "lodash/cloneDeep";
import Mission from "./mission";
import { DEFAULT_MISSION_SET_NAME, UNASSIGNED_ID } from "../../utils/constants";
import { Speeds } from "../../shared/proto/jaiabot/messages/mission";

// This constant will be used to track versions of mission sets
// exported to files, update whenever the class or supporting
// classes are updated
export const MISSION_SET_VERSION = "2.0";

export interface MissionSetSnapshot {
    missions: [number, Mission][];
    nextMissionID: number;
    missionIDInEditMode: number;
    missionSpeeds: Speeds;
    name: string;
}

export class MissionSet {
    private missions: Map<number, Mission>;
    private ghostMissions: Map<number, Mission>;
    private nextMissionID: number;
    private missionIDInEditMode: number;
    private missionSpeeds: Speeds;
    private name: string;

    constructor() {
        this.missions = new Map<number, Mission>();
        this.ghostMissions = new Map<number, Mission>();
        this.nextMissionID = 1;
        this.missionIDInEditMode = UNASSIGNED_ID;
        this.missionSpeeds = { transit: 2, stationkeep_outer: 2 };
        this.name = DEFAULT_MISSION_SET_NAME;
    }

    getMissions() {
        return this.missions;
    }

    setMissions(missions: Map<number, Mission>) {
        this.missions = missions;
    }

    getGhostMissions() {
        return this.ghostMissions;
    }

    setGhostMissions(missions: Map<number, Mission>) {
        this.ghostMissions = missions;
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
        this.setName(DEFAULT_MISSION_SET_NAME);
        this.setNextMissionID(1);
    }

    addGhostMission(missionID: number) {
        const ghostMission = cloneDeep(this.missions.get(missionID));
        ghostMission.getGhostParameters().isGhost = true;
        this.ghostMissions.set(missionID, ghostMission);
    }

    deleteGhostMission(missionID: number) {
        this.ghostMissions.delete(missionID);
    }

    deleteAllGhostMissions() {
        this.ghostMissions.clear();
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
        const restored = cloneDeep(snapshot);

        // Clear current mission set
        this.deleteAllMissions();

        // Rebuild mission set from snapshot
        if (Array.isArray(snapshot.missions)) {
            restored.missions.forEach(([id, mission]) => {
                this.missions.set(id, mission);
            });
        }
        this.nextMissionID = restored.nextMissionID;
        this.missionIDInEditMode = restored.missionIDInEditMode;
        this.missionSpeeds = restored.missionSpeeds;
        this.name = restored.name;
    }
}

export const missionSet = new MissionSet();

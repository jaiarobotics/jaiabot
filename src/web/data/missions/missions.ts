import Mission from "./mission";
import { UNASSIGNED_ID } from "../../utils/constants";
import { Speeds, GeographicCoordinate } from "../../types/protobuf-types";
import Waypoint from "../waypoints/waypoint";
import Task from "../tasks/task";

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

        const newMission = Object.assign(new Mission(), JSON.parse(jsonMission));

        // Transform waypoint data to waypoint class objects
        newMission.waypoints = newMission.waypoints.map((wp: any) => {
            const waypoint = Object.assign(new Waypoint(), wp);

            // Transform task data to objects
            if (wp.task) {
                const task = Object.assign(new Task(), wp.task);
                waypoint.setTask(task);
            }

            // Transform location data to objects
            waypoint.setLocation(wp.location);
            return waypoint;
        });

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
        localStorage.setItem(saveName, JSON.stringify(missions));
    }

    /**
     * Replaces all current missions with those from a save set
     *
     * @param saveName : string Name of saved set to retrieve
     *
     */
    loadAllMissions(saveName: string) {}
}

export const missions = new Missions();

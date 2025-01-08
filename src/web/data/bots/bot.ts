import { MissionStatus } from "../../types/jaia-system-types";
import { BotType, Error, HealthState, Warning } from "../../utils/protobuf-types";
import Mission from "../missions/mission";
import TaskPacket from "../task_packets/task-packets-new";
import BotSensors from "./bot-sensors";

export default class Bot {
    private botID: number;
    private botType: BotType;
    private healthState: HealthState;
    private errors: Error[];
    private warnings: Warning[];
    private mission: Mission;
    private missionStatus: MissionStatus;
    private botSensors: BotSensors;
    private taskPackets: TaskPacket[];
    private batteryPercent: number;
    private wifiLinkQuality: number;
    private statusAge: number;

    constructor() {
        // Init base sensors
        this.botSensors = new BotSensors();
    }

    getBotID() {
        return this.botID;
    }

    setBotID(botID: number) {
        this.botID = botID;
    }

    getBotType() {
        return this.botType;
    }

    setBotType(botType: BotType) {
        this.botType = botType;
        this.initializeSensors();
    }

    getHealthState() {
        return this.healthState;
    }

    setHealthState(healthState: HealthState) {
        this.healthState = healthState;
    }

    getErrors() {
        return this.errors;
    }

    setErrors(errors: Error[]) {
        this.errors = errors;
    }

    getWarnings() {
        return this.warnings;
    }

    setWarnings(warnings: Warning[]) {
        this.warnings = warnings;
    }

    getMission() {
        return this.mission;
    }

    setMission(mission: Mission) {
        this.mission = mission;
    }

    getMissionStatus() {
        return this.missionStatus;
    }

    setMissionStatus(missionStatus: MissionStatus) {
        this.missionStatus = missionStatus;
    }

    getBotSensors() {
        return this.botSensors;
    }

    // setBotSensors does not exists because the sensor init is handled when the Bot type is received

    getBatteryPercent() {
        return this.batteryPercent;
    }

    setBatteryPercent(batteryPercent: number) {
        this.batteryPercent = batteryPercent;
    }

    getWifiLinkQuality() {
        return this.wifiLinkQuality;
    }

    setWifiLinkQuality(wifiLinkQuality: number) {
        this.wifiLinkQuality = wifiLinkQuality;
    }

    getStatusAge() {
        return this.statusAge;
    }

    setStatusAge(statusAge: number) {
        this.statusAge = statusAge;
    }

    getTaskPackets() {
        return this.taskPackets;
    }

    addTaskPacket(taskPacket: TaskPacket) {
        this.taskPackets.push(taskPacket);
    }

    private initializeSensors() {
        switch (this.getBotType()) {
            case BotType.ECHO:
                this.getBotSensors().initPAMSensors();
                break;
            default:
                break;
        }
    }
}

module.exports = Bot;

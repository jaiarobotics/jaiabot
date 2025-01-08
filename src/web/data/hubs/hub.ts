import {
    BotOffloadData,
    Error,
    HealthState,
    LinuxHardwareStatus,
    Warning,
} from "../../utils/protobuf-types";
import HubSensors from "./hub-sensors";

export default class Hub {
    private hubID: number;
    private fleetID: number;
    private healthState: HealthState;
    private errors: Error[];
    private warnings: Warning[];
    private hubSensors: HubSensors;
    private linuxHardwareStatus: LinuxHardwareStatus;
    private botOffload: BotOffloadData;
    private statusAge: number;

    constructor() {
        // Init base sensors
        this.hubSensors = new HubSensors();
    }

    getHubID() {
        return this.hubID;
    }

    setHubID(hubID: number) {
        this.hubID = hubID;
    }

    getFleetID() {
        return this.fleetID;
    }

    setFleetID(fleetID: number) {
        this.fleetID = fleetID;
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

    getHubSensors() {
        return this.hubSensors;
    }

    getLinuxHardwareStatus() {
        return this.linuxHardwareStatus;
    }

    setLinuxHardwareStatus(linuxHardwareStatus: LinuxHardwareStatus) {
        this.linuxHardwareStatus = linuxHardwareStatus;
    }

    getBotOffload() {
        return this.botOffload;
    }

    setBotOffload(botOffload: BotOffloadData) {
        this.botOffload = botOffload;
    }

    getStatusAge() {
        return this.statusAge;
    }

    setStatusAge(statusAge: number) {
        this.statusAge = statusAge;
    }
}

import {
    BotOffloadData,
    Error,
    GeographicCoordinate,
    HealthState,
    LinuxHardwareStatus,
    Warning,
} from "../../types/protobuf-types";
import { NO_COMMS_STATUS_AGE } from "../../utils/constants";
import { microsecondsToSeconds } from "../../utils/conversions";
import { timestampToLocaleTimeString } from "../../utils/conversions";
import HubSensors from "./hub-sensors";

export default class Hub {
    private hubID: number;
    private fleetID: number;
    private healthState: HealthState;
    private errors: Error[];
    private warnings: Warning[];
    private hubSensors: HubSensors;
    private location: GeographicCoordinate;
    private linuxHardwareStatus: LinuxHardwareStatus;
    private botOffload: BotOffloadData;
    private statusAge: number;
    private systemTime: string;

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

    getLocation() {
        return this.location;
    }

    setLocation(location: GeographicCoordinate) {
        this.location = location;
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

    getSystemTime() {
        return this.systemTime;
    }

    setSystemTime(systemTime: number) {
        this.systemTime = timestampToLocaleTimeString(systemTime);
    }

    /**
     * Determines if the hub has lost comms with the client
     *
     * @returns true if the hub has lost comms with the client
     */
    isCommsDropped(): boolean {
        return microsecondsToSeconds(this.getStatusAge()) > NO_COMMS_STATUS_AGE;
    }
}

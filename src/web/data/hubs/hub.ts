import {
    BotOffloadData,
    Error,
    GeographicCoordinate,
    HealthState,
    LinuxHardwareStatus,
    Warning,
} from "../../types/protobuf-types";
import { jaiaAPI } from "../../utils/jaia-api";
import { NO_COMMS_STATUS_AGE, NO_CONTENT_SIZE } from "../../utils/constants";
import { microsecondsToSeconds } from "../../utils/conversions";
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

        if (this.botOffload.offload_succeeded && !this.botOffload.bots_pending) {
            this.getCTDFiles();
        }
    }

    getStatusAge() {
        return this.statusAge;
    }

    setStatusAge(statusAge: number) {
        this.statusAge = statusAge;
    }

    /**
     * Determines if the hub has lost comms with the client
     *
     * @returns true if the hub has lost comms with the client
     */
    isCommsDropped(): boolean {
        return microsecondsToSeconds(this.getStatusAge()) > NO_COMMS_STATUS_AGE;
    }

    /**
     * Gets the CTD files from the Hub and downloads them to the client computer
     *
     * @param {number} botID Identifies which files to get
     * @param {boolean} deleteCTDFiles Clear the files from the Hub after download
     * @returns {void}
     */
    async getCTDFiles() {
        const res = await jaiaAPI.getCTDProfiles();
        const blob = await res.blob();
        if (blob.size == NO_CONTENT_SIZE) {
            return;
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "jaia-ctd";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }
}

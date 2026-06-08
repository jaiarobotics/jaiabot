import { BotModes } from "../../types/jaia-system-types";
import { MissionStatus } from "../../types/jaia-system-types";
import {
    BotType,
    Engineering,
    Error,
    GeographicCoordinate,
    HealthState,
    Warning,
    ActiveLink,
    Link,
} from "../../types/protobuf-types";
import { IRIDIUM_NO_COMMS_STATUS_AGE, NO_COMMS_STATUS_AGE } from "../../utils/constants";
import { microsecondsToSeconds } from "../../utils/conversions";
import BotSensors from "./bot-sensors";

export default class Bot {
    private botID: number;
    private botType: BotType;
    private healthState: HealthState;
    private errors: Error[];
    private warnings: Warning[];
    private missionStatus: MissionStatus;
    private botSensors: BotSensors;
    private location: GeographicCoordinate;
    private batteryPercent: number;
    private wifiLinkQuality: number;
    private statusAge: number;
    private link: Link;
    private activeLinks: ActiveLink[];
    private activeLinkStatusAges: { [link: string]: number };
    private engineering: Engineering;
    private mode: BotModes;

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

    getMissionStatus() {
        return this.missionStatus;
    }

    setMissionStatus(missionStatus: MissionStatus) {
        this.missionStatus = missionStatus;
    }

    getBotSensors() {
        return this.botSensors;
    }

    getLocation() {
        return this.location;
    }

    setLocation(location: GeographicCoordinate) {
        this.location = location;
    }

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

    // microseconds
    getStatusAge() {
        return this.statusAge;
    }

    // microseconds
    setStatusAge(statusAge: number) {
        this.statusAge = statusAge;
    }

    getLink() {
        return this.link;
    }

    setLink(link: Link) {
        this.link = link;
    }

    getActiveLinks(): ActiveLink[] {
        return this.activeLinks ?? [];
    }

    setActiveLinks(activeLinks: ActiveLink[]) {
        this.activeLinks = activeLinks;
    }

    getActiveLinkStatusAges(): { [link: string]: number } {
        return this.activeLinkStatusAges ?? {};
    }

    setActiveLinkStatusAges(activeLinkStatusAges: { [link: string]: number }) {
        this.activeLinkStatusAges = activeLinkStatusAges;
    }

    getEngineering() {
        return this.engineering;
    }

    setEngineering(engineering: Engineering) {
        this.engineering = engineering;
    }

    getMode() {
        return this.mode;
    }

    setMode(mode: BotModes) {
        this.mode = mode;
    }

    /**
     * Determines if the Bot has lost comms with the Hub based on the age of the portal status and link type
     * Takes into account link type (Iridium has a longer timeout)
     *
     * @returns true if the bot has lost comms with the hub
     */
    isCommsDropped(): boolean {
        const commsTimeout =
            this.getLink() === Link.LINK_IRIDIUM
                ? IRIDIUM_NO_COMMS_STATUS_AGE
                : NO_COMMS_STATUS_AGE;
        return microsecondsToSeconds(this.getStatusAge()) > commsTimeout;
    }

    private initializeSensors() {
        switch (this.getBotType()) {
            case BotType.PAM:
                this.getBotSensors().initPAMSensors();
                break;
            default:
                break;
        }
    }
}

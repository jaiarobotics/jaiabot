import { PortalBotStatus } from "../../shared/PortalStatus";
import { MissionStatus } from "../../types/jaia-system-types";
import { BotType } from "../../types/protobuf-types";

import Bot from "./bot";

/**
 * Maintains a sorted map of all Bots in the system
 *
 * @notes Users of the class can rely on the map returned by
 *        getBots to be ordered by Bot ID
 */
export class Bots {
    private bots: Map<number, Bot>;
    private tick: number;

    constructor() {
        this.bots = new Map<number, Bot>();
        this.tick = 0;
    }

    getBots() {
        return this.bots;
    }

    getTick() {
        return this.tick;
    }

    setTick(tick: number) {
        this.tick = tick;
    }

    getBot(botID: number) {
        return this.bots.get(botID);
    }

    setBot(botStatus: PortalBotStatus) {
        if (botStatus.bot_id === undefined) {
            return;
        }

        if (this.isNewBot(botStatus.bot_id)) {
            const newBot = new Bot();
            newBot.setBotID(botStatus.bot_id);
            this.bots.set(botStatus.bot_id, newBot);
            this.sortBots();
        }

        this.updateBot(botStatus);
    }

    private isNewBot(botID: number) {
        if (this.bots.get(botID) === undefined) {
            return true;
        }
        return false;
    }

    private sortBots() {
        const sortedBots = new Map(
            [...this.bots.entries()].sort((a, b) => a[1].getBotID() - b[1].getBotID()),
        );
        this.bots = sortedBots;
    }

    private updateBot(botStatus: PortalBotStatus) {
        let bot = this.bots.get(botStatus.bot_id);

        if (bot === undefined) {
            return;
        }

        if (botStatus.bot_id) {
            bot.setBotID(botStatus.bot_id);
        }

        if (botStatus.bot_type) {
            bot.setBotType(botStatus.bot_type);
        }

        if (botStatus.health_state) {
            bot.setHealthState(botStatus.health_state);
        }

        if (botStatus.error) {
            bot.setErrors(botStatus.error);
        }

        if (!botStatus.error) {
            bot.setErrors([]);
        }

        if (botStatus.warning) {
            bot.setWarnings(botStatus.warning);
        }

        if (!botStatus.warning) {
            bot.setWarnings([]);
        }

        if (botStatus.location) {
            bot.setLocation(botStatus.location);
        }

        if (botStatus.battery_percent) {
            bot.setBatteryPercent(botStatus.battery_percent);
        }

        if (botStatus.wifi_link_quality_percentage) {
            bot.setWifiLinkQuality(botStatus.wifi_link_quality_percentage);
        }

        if (botStatus.portalStatusAge) {
            bot.setStatusAge(botStatus.portalStatusAge);
        }

        if (botStatus.link) {
            bot.setLink(botStatus.link);
        }

        if (botStatus.active_links) {
            bot.setActiveLinks(botStatus.active_links);
        } else {
            bot.setActiveLinks([]);
        }

        if (botStatus.active_link_status_age) {
            bot.setActiveLinkStatusAges(botStatus.active_link_status_age);
        } else {
            bot.setActiveLinkStatusAges({});
        }

        if (botStatus.engineering) {
            bot.setEngineering(botStatus.engineering);
        }

        // MissionStatus
        let missionStatus: MissionStatus = {};

        if (botStatus.mission_state) {
            missionStatus.missionState = botStatus.mission_state;
        }

        if (botStatus.active_goal) {
            missionStatus.targetWaypoint = botStatus.active_goal;
        }

        if (botStatus.distance_to_active_goal) {
            missionStatus.distanceToTargetWaypoint = botStatus.distance_to_active_goal;
        }

        if (botStatus.repeat_index) {
            missionStatus.repeatIndex = botStatus.repeat_index;
        }

        if (botStatus.constant_heading_time_remaining !== undefined) {
            missionStatus.constantHeadingTimeRemaining = botStatus.constant_heading_time_remaining;
        }

        bot.setMissionStatus(missionStatus);

        // BotSensors
        // GPS
        if (botStatus.location?.lat) {
            bot.getBotSensors().getGPS().setLat(botStatus.location.lat);
        }

        if (botStatus.location?.lon) {
            bot.getBotSensors().getGPS().setLon(botStatus.location.lon);
        }

        if (botStatus.hdop) {
            bot.getBotSensors().getGPS().setHDOP(botStatus.hdop);
        }

        if (botStatus.pdop) {
            bot.getBotSensors().getGPS().setPDOP(botStatus.pdop);
        }

        if (botStatus.speed?.over_ground) {
            bot.getBotSensors().getGPS().setSpeedOverGround(botStatus.speed.over_ground);
        }

        if (botStatus.attitude?.course_over_ground) {
            bot.getBotSensors().getGPS().setCourseOverGround(botStatus.attitude.course_over_ground);
        }

        // IMU
        if (botStatus.attitude?.heading) {
            bot.getBotSensors().getIMU().setHeading(botStatus.attitude.heading);
        }

        if (botStatus.attitude?.pitch) {
            bot.getBotSensors().getIMU().setPitch(botStatus.attitude.pitch);
        }

        if (botStatus.attitude?.roll) {
            bot.getBotSensors().getIMU().setRoll(botStatus.attitude.roll);
        }

        if (botStatus.calibration_status) {
            bot.getBotSensors().getIMU().setCalibrationStatus(botStatus.calibration_status);
        }

        // Pressure
        if (botStatus.depth) {
            bot.getBotSensors().getPressureSensor().setDepth(botStatus.depth);
        }

        // Temperature
        if (botStatus.temperature) {
            bot.getBotSensors().getTemperatureSensor().setTemperature(botStatus.temperature);
        }
    }

    includesPAM() {
        for (const [botID, bot] of this.bots) {
            if (bot.getBotType() === BotType.ECHO) {
                return true;
            }
        }
        return false;
    }
}

export const bots = new Bots();

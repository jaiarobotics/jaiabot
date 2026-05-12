import Bot from "../data/bots/bot";
import Mission from "../data/mission_set/mission";
import { BotType, TaskType } from "../types/protobuf-types";

const DEFAULT_TRANSIT_SPEED_M_S = 2.0;
const EARTH_R = 6_371_000;

export interface BatteryPrediction {
    predicted_drain_pct: number;
    predicted_final_pct: number;
}

/**
 * Calculates the great-circle distance in meters between two geographic coordinates
 *
 * @param {number} lat1 Latitude of the first point in degrees
 * @param {number} lon1 Longitude of the first point in degrees
 * @param {number} lat2 Latitude of the second point in degrees
 * @param {number} lon2 Longitude of the second point in degrees
 * @returns {number} Distance between the two points in meters
 */
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = Math.PI / 180;
    const dlat = (lat2 - lat1) * toRad;
    const dlon = (lon2 - lon1) * toRad;
    const h =
        Math.sin(dlat / 2) ** 2 +
        Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dlon / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Converts a BotType enum value to the integer used by the prediction model
 *
 * @param {BotType} botType The bot's hardware type
 * @returns {number} Integer representation of the bot type expected by the model
 */
function botTypeToInt(botType: BotType): number {
    switch (botType) {
        case BotType.ECHO:
            return 2;
        default:
            return 1;
    }
}

/**
 * Extracts mission features from a Mission and Bot, sends them to the hub's
 * battery prediction endpoint, and returns the predicted drain and final battery percentage
 *
 * @param {Mission} mission Used to derive waypoint distances, dive counts, and depth
 * @param {Bot} bot Used to provide the starting battery percentage and bot type
 * @returns {Promise<BatteryPrediction | null>} Predicted drain and final battery %, or null if the request fails
 */
export async function fetchBatteryPrediction(
    mission: Mission,
    bot: Bot,
): Promise<BatteryPrediction | null> {
    const waypoints = mission.getWaypoints();

    let totalDistanceM = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        const a = waypoints[i].getLocation();
        const b = waypoints[i + 1].getLocation();
        if (a?.lat != null && a?.lon != null && b?.lat != null && b?.lon != null) {
            totalDistanceM += haversineMeters(a.lat, a.lon, b.lat, b.lon);
        }
    }

    const transitSpeed = mission.getSpeeds()?.transit ?? DEFAULT_TRANSIT_SPEED_M_S;
    const durationS = transitSpeed > 0 ? totalDistanceM / transitSpeed : 0;
    const motorEnergyProxy = totalDistanceM * transitSpeed;

    let numDives = 0;
    let totalDepthM = 0;
    for (const waypoint of waypoints) {
        const task = waypoint.getTask();
        if (task?.getType() === TaskType.DIVE) {
            numDives++;
            totalDepthM += task.getDiveParameters()?.max_depth ?? 0;
        }
    }

    try {
        const response = await fetch("/battery-prediction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                bot_type: botTypeToInt(bot.getBotType()),
                duration_s: durationS,
                motor_energy_proxy: motorEnergyProxy,
                num_dives: numDives,
                total_depth_m: totalDepthM,
                starting_battery_pct: bot.getBatteryPercent(),
            }),
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

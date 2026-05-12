import Bot from "../data/bots/bot";
import Mission from "../data/mission_set/mission";
import { BotType, TaskType } from "../types/protobuf-types";
import { BOTTOM_DIVE_DEPTH_PRIOR_M } from "./constants";

const DEFAULT_TRANSIT_SPEED_M_S = 2.0;
const EARTH_R = 6_371_000;
const HOTEL_LOAD_W = 4.0;
// Measured motor draw at known transit speeds (m/s → watts)
const MOTOR_POWER_W = new Map<number, number>([
    [2.0, 71.0],
    [2.2, 75.0],
    [3.0, 181.0],
]);

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
 * Estimates transit energy in Wh using piecewise linear interpolation over
 * the hardware-spec motor power curve plus constant hotel load
 *
 * @param {number} distanceM Total planned transit distance in meters
 * @param {number} speedMs Transit speed in m/s
 * @returns {number} Estimated energy in Watt-hours
 */
function estimatedTransitEnergyWh(distanceM: number, speedMs: number): number {
    if (speedMs <= 0) return 0;
    const speeds = Array.from(MOTOR_POWER_W.keys()).sort((a, b) => a - b);
    const watts = speeds.map((s) => MOTOR_POWER_W.get(s)!);
    let motorW = watts[watts.length - 1];
    if (speedMs <= speeds[0]) {
        motorW = watts[0];
    } else {
        for (let i = 0; i < speeds.length - 1; i++) {
            if (speedMs <= speeds[i + 1]) {
                const t = (speedMs - speeds[i]) / (speeds[i + 1] - speeds[i]);
                motorW = watts[i] + t * (watts[i + 1] - watts[i]);
                break;
            }
        }
    }
    return (motorW + HOTEL_LOAD_W) * (distanceM / speedMs / 3600);
}

/**
 * Computes total turn angle and mean waypoint spacing from a sequence of locations
 *
 * @param {Array} locs Array of {lat, lon} waypoint locations in degrees
 * @returns {{ totalTurnAngleDeg: number; meanWaypointSpacingM: number }} Geometry summary
 */
function waypointGeometry(locs: { lat: number; lon: number }[]): {
    totalTurnAngleDeg: number;
    meanTurnAngleDeg: number;
    meanWaypointSpacingM: number;
} {
    if (locs.length < 2)
        return { totalTurnAngleDeg: 0, meanTurnAngleDeg: 0, meanWaypointSpacingM: 0 };
    const dists: number[] = [];
    for (let i = 0; i < locs.length - 1; i++) {
        dists.push(haversineMeters(locs[i].lat, locs[i].lon, locs[i + 1].lat, locs[i + 1].lon));
    }
    const meanWaypointSpacingM = dists.reduce((a, b) => a + b, 0) / dists.length;
    if (locs.length < 3) return { totalTurnAngleDeg: 0, meanTurnAngleDeg: 0, meanWaypointSpacingM };
    const avgLatRad = (locs.reduce((s, l) => s + l.lat, 0) / locs.length) * (Math.PI / 180);
    const toRad = Math.PI / 180;
    const dx = locs
        .slice(1)
        .map((l, i) => (l.lon - locs[i].lon) * toRad * EARTH_R * Math.cos(avgLatRad));
    const dy = locs.slice(1).map((l, i) => (l.lat - locs[i].lat) * toRad * EARTH_R);
    const turnAngles: number[] = [];
    for (let i = 0; i < dx.length - 1; i++) {
        const magIn = Math.sqrt(dx[i] ** 2 + dy[i] ** 2);
        const magOut = Math.sqrt(dx[i + 1] ** 2 + dy[i + 1] ** 2);
        if (magIn > 0 && magOut > 0) {
            const cosAngle = Math.max(
                -1,
                Math.min(1, (dx[i] * dx[i + 1] + dy[i] * dy[i + 1]) / (magIn * magOut)),
            );
            turnAngles.push((Math.acos(cosAngle) * 180) / Math.PI);
        }
    }
    const totalTurnAngleDeg = turnAngles.reduce((a, b) => a + b, 0);
    const meanTurnAngleDeg = turnAngles.length > 0 ? totalTurnAngleDeg / turnAngles.length : 0;
    return { totalTurnAngleDeg, meanTurnAngleDeg, meanWaypointSpacingM };
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
    const repeats = mission.getRepeats() ?? 1;

    const transitSpeed = mission.getSpeeds()?.transit ?? DEFAULT_TRANSIT_SPEED_M_S;
    let transitEnergyWh = 0;
    let diveCount = 0;
    let diveDepthM = 0;
    let diveHoldS = 0;
    let diveHoldStops = 0;
    let driftCount = 0;
    let driftTotalS = 0;
    let stationKeepCount = 0;
    let stationKeepTotalS = 0;

    const botLoc = bot.getLocation();
    let curLat: number | null = botLoc?.lat ?? null;
    let curLon: number | null = botLoc?.lon ?? null;

    for (const waypoint of waypoints) {
        const loc = waypoint.getLocation();
        if (loc?.lat != null && loc?.lon != null) {
            if (curLat != null && curLon != null) {
                transitEnergyWh += estimatedTransitEnergyWh(
                    haversineMeters(curLat, curLon, loc.lat, loc.lon),
                    transitSpeed,
                );
            }
            curLat = loc.lat;
            curLon = loc.lon;
        }

        const task = waypoint.getTask();
        if (!task) continue;
        const taskType = task.getType();

        if (taskType === TaskType.DIVE) {
            diveCount++;
            const diveParams = task.getDiveParameters();
            const depth = diveParams?.bottom_dive
                ? BOTTOM_DIVE_DEPTH_PRIOR_M
                : (diveParams?.max_depth ?? 0);
            diveDepthM += depth;
            diveHoldS += diveParams?.hold_time ?? 0;
            const interval = diveParams?.depth_interval;
            diveHoldStops += !interval || interval >= depth ? 1 : Math.ceil(depth / interval);
        } else if (taskType === TaskType.CONSTANT_HEADING) {
            const chParams = task.getConstantHeadingParameters();
            const chSpeed = chParams?.constant_heading_speed ?? 0;
            const chTime = chParams?.constant_heading_time ?? 0;
            const chHeadingDeg = chParams?.constant_heading ?? 0;
            if (chSpeed > 0 && chTime > 0 && curLat != null && curLon != null) {
                const chDistM = chSpeed * chTime;
                transitEnergyWh += estimatedTransitEnergyWh(chDistM, chSpeed);
                const headingRad = (chHeadingDeg * Math.PI) / 180;
                curLat += (chDistM * Math.cos(headingRad) * 180) / (Math.PI * EARTH_R);
                curLon +=
                    (chDistM * Math.sin(headingRad) * 180) /
                    (Math.PI * EARTH_R * Math.cos((curLat * Math.PI) / 180));
            }
        } else if (taskType === TaskType.SURFACE_DRIFT) {
            driftCount++;
            driftTotalS += task.getDriftParameters()?.drift_time ?? 0;
        } else if (taskType === TaskType.STATION_KEEP) {
            stationKeepCount++;
            stationKeepTotalS += task.getStationKeepParameters()?.station_keep_time ?? 0;
        }
    }

    const waypointLocs = waypoints
        .map((wp) => wp.getLocation())
        .filter((loc): loc is { lat: number; lon: number } => loc?.lat != null && loc?.lon != null);
    const { totalTurnAngleDeg, meanTurnAngleDeg, meanWaypointSpacingM } =
        waypointGeometry(waypointLocs);

    // Return leg from last position back to first waypoint, paid (repeats-1) times
    const firstLoc = waypoints[0]?.getLocation();
    if (
        repeats > 1 &&
        firstLoc?.lat != null &&
        firstLoc?.lon != null &&
        curLat != null &&
        curLon != null
    ) {
        const returnDistM = haversineMeters(curLat, curLon, firstLoc.lat, firstLoc.lon);
        transitEnergyWh =
            transitEnergyWh * repeats +
            estimatedTransitEnergyWh(returnDistM, transitSpeed) * (repeats - 1);
    } else {
        transitEnergyWh *= repeats;
    }
    diveCount *= repeats;
    diveDepthM *= repeats;
    diveHoldS *= repeats;
    diveHoldStops *= repeats;
    driftCount *= repeats;
    driftTotalS *= repeats;
    stationKeepCount *= repeats;
    stationKeepTotalS *= repeats;

    try {
        const response = await fetch("/battery-prediction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                bot_type: botTypeToInt(bot.getBotType()),
                transit_energy_wh: transitEnergyWh,
                total_turn_angle_deg: totalTurnAngleDeg,
                mean_turn_angle_deg: meanTurnAngleDeg,
                mean_waypoint_spacing_m: meanWaypointSpacingM,
                drift_count: driftCount,
                drift_total_s: driftTotalS,
                station_keep_count: stationKeepCount,
                station_keep_total_s: stationKeepTotalS,
                dive_count: diveCount,
                dive_depth_m: diveDepthM,
                dive_hold_s: diveHoldS,
                dive_hold_stops: diveHoldStops,
                starting_battery_pct: bot.getBatteryPercent(),
            }),
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

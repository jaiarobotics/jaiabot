import { getDistance } from "ol/sphere";

import Bot from "../bots/bot";
import Mission from "../mission_set/mission";
import { TaskType } from "../../types/protobuf-types";
import { BOTTOM_DIVE_DEPTH_PRIOR_M } from "../../utils/constants";

// Drain can legitimately exceed 100% (the mission needs more than one battery), so the
// display cap is well above it and callers flag anything at the cap as "greater than"
export const MAX_DISPLAYED_DRAIN_PERCENT = 1000;

const BATTERY_CALIBRATION_URL = "/battery-calibration";
const BATTERY_PREDICTION_URL = "/battery-prediction";

const EARTH_R = 6_371_000;

// Empirical floor: when commanded below 2.0 m/s the bot still achieves ~1.7 m/s
// in the logs because the motor has a minimum-throttle floor. Clamping at 2.0
// keeps both transit-time and the wattage lookup honest for slow plans.
const MIN_PLANNED_SPEED_M_S = 2.0;

export interface BatteryPrediction {
    predicted_drain_pct: number;
    predicted_final_pct: number;
}

interface Calibration {
    transitPowerCurve: Map<number, number>;
    diveHoldW: number;
    surfaceDriftW: number;
    stationKeepW: number;
    diveEnergyBaseWh: number;
    diveEnergyPerMWh: number;
    supportedBotTypes: string[];
}

interface RawCalibration {
    dive_hold_w: number;
    surface_drift_w: number;
    station_keep_w: number;
    dive_energy_base_wh: number;
    dive_energy_per_m: number;
    transit_speeds_m_s: number[];
    transit_watts: number[];
    supported_bot_types: string[];
}

// Fetched once from the hub and cached for the lifetime of the page, since these
// calibrated constants don't change at runtime.
let calibrationPromise: Promise<Calibration> | null = null;

/**
 * Fetches and caches the calibrated wattage/energy constants from the hub
 *
 * @returns {Promise<Calibration>} Calibration constants used to derive mission energy features
 */
function getCalibration(): Promise<Calibration> {
    if (calibrationPromise === null) {
        calibrationPromise = fetch(BATTERY_CALIBRATION_URL)
            .then((response) => {
                if (!response.ok) throw new Error("battery-calibration request failed");
                return response.json();
            })
            .then(
                (raw: RawCalibration): Calibration => ({
                    transitPowerCurve: new Map(
                        raw.transit_speeds_m_s.map((s, i) => [s, raw.transit_watts[i]]),
                    ),
                    diveHoldW: raw.dive_hold_w,
                    surfaceDriftW: raw.surface_drift_w,
                    stationKeepW: raw.station_keep_w,
                    diveEnergyBaseWh: raw.dive_energy_base_wh,
                    diveEnergyPerMWh: raw.dive_energy_per_m,
                    supportedBotTypes: raw.supported_bot_types,
                }),
            )
            .catch((e) => {
                calibrationPromise = null;
                throw e;
            });
    }
    return calibrationPromise;
}

/**
 * Checks whether the battery drain model was trained on the given bot type
 *
 * @param {string} botType The bot's hardware type, as reported by the hub
 * @returns {Promise<boolean>} True if the model can predict for this bot type, or if that
 *   can't be determined (e.g. the hub is unreachable) -- callers shouldn't claim a bot
 *   type is unsupported when the real reason is a failed request.
 */
export async function isBotTypeSupported(botType: string): Promise<boolean> {
    try {
        const calibration = await getCalibration();
        return calibration.supportedBotTypes.includes(botType);
    } catch {
        return true;
    }
}

/**
 * Clamps a predicted final battery percentage for display, since a battery can't
 * read below empty. The raw predicted_final_pct is left untouched everywhere else
 * (e.g. the insufficient-battery threshold check) so it can still go negative there.
 *
 * @param {number} predictedFinalPct Raw predicted final battery percentage
 * @returns {number} Predicted final battery percentage clamped to a minimum of 0
 */
export function clampBatteryPercentForDisplay(predictedFinalPct: number): number {
    return Math.max(0, predictedFinalPct);
}

/**
 * Clamps a predicted drain percentage for display
 *
 * @param {number} predictedDrainPct Raw predicted drain percentage
 * @returns {number} Predicted drain percentage clamped to MAX_DISPLAYED_DRAIN_PERCENT
 */
export function clampDrainPercentForDisplay(predictedDrainPct: number): number {
    return Math.min(MAX_DISPLAYED_DRAIN_PERCENT, predictedDrainPct);
}

/**
 * Estimates transit energy in Wh using piecewise linear interpolation over
 * the calibrated planned-speed -> watts curve. The curve already includes
 * hotel load because it's measured from total battery current, not motor-only.
 *
 * @param {number} distanceM Total planned transit distance in meters
 * @param {number} speedMs Planned transit speed in m/s (clamped at MIN_PLANNED_SPEED_M_S
 *   by the caller; below that the bot can't actually slow down and overshoots)
 * @param {Map<number, number>} transitPowerCurve Calibrated planned-speed -> watts curve
 * @returns {number} Estimated energy in Watt-hours
 */
function estimatedTransitEnergyWh(
    distanceM: number,
    speedMs: number,
    transitPowerCurve: Map<number, number>,
): number {
    if (speedMs <= 0) return 0;
    const curve = Array.from(transitPowerCurve.entries()).sort((a, b) => a[0] - b[0]);
    const speeds = curve.map(([speed]) => speed);
    const watts = curve.map(([, w]) => w);
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
    return motorW * (distanceM / speedMs / 3600);
}

/**
 * Computes turning geometry features from a sequence of waypoint locations
 *
 * @param {{ lat: number; lon: number }[]} locs Waypoint locations in degrees
 * @returns {{ turnDensityDegPerKm: number }} Total turn angle per km travelled
 */
function waypointGeometry(locs: { lat: number; lon: number }[]): {
    turnDensityDegPerKm: number;
} {
    if (locs.length < 3) return { turnDensityDegPerKm: 0 };
    const dists: number[] = [];
    for (let i = 0; i < locs.length - 1; i++) {
        dists.push(
            getDistance([locs[i].lon, locs[i].lat], [locs[i + 1].lon, locs[i + 1].lat], EARTH_R),
        );
    }
    const totalDistanceKm = dists.reduce((a, b) => a + b, 0) / 1000;
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
    const turnDensityDegPerKm = totalDistanceKm > 0 ? totalTurnAngleDeg / totalDistanceKm : 0;
    return { turnDensityDegPerKm };
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
    if (waypoints.length === 0) return null;

    let calibration: Calibration;
    try {
        calibration = await getCalibration();
    } catch {
        return null;
    }

    const repeats = mission.getRepeats() ?? 1;

    const rawTransitSpeed = mission.getTransitSpeed();
    const transitSpeed = Math.max(rawTransitSpeed, MIN_PLANNED_SPEED_M_S);
    // Separate bot→first leg from plan-internal energy so we can scale them
    // differently when `repeats > 1`. The bot→first leg only happens once;
    // plan-internal legs and CONSTANT_HEADING contributions are paid per pass.
    let toFirstEnergyWh = 0;
    let singlePassEnergyWh = 0;
    let toFirstDistanceM = 0;
    let singlePassDistanceM = 0;
    let singlePassExtraTimeS = 0; // CONSTANT_HEADING durations per pass
    let firstWaypointSeen = false;
    let diveCount = 0;
    let diveDepthM = 0;
    let diveHoldS = 0;
    let driftTotalS = 0;
    let stationKeepTotalS = 0;

    const botLoc = bot.getLocation();
    let curLat: number | null = botLoc?.lat ?? null;
    let curLon: number | null = botLoc?.lon ?? null;

    for (const waypoint of waypoints) {
        const loc = waypoint.getLocation();
        if (loc?.lat != null && loc?.lon != null) {
            if (curLat != null && curLon != null) {
                const legDistance = getDistance([curLon, curLat], [loc.lon, loc.lat], EARTH_R);
                const legEnergy = estimatedTransitEnergyWh(
                    legDistance,
                    transitSpeed,
                    calibration.transitPowerCurve,
                );
                if (!firstWaypointSeen) {
                    toFirstEnergyWh += legEnergy;
                    toFirstDistanceM += legDistance;
                } else {
                    singlePassEnergyWh += legEnergy;
                    singlePassDistanceM += legDistance;
                }
            }
            firstWaypointSeen = true;
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
        } else if (taskType === TaskType.CONSTANT_HEADING) {
            const chParams = task.getConstantHeadingParameters();
            const chSpeed = chParams?.constant_heading_speed ?? 0;
            const chTime = chParams?.constant_heading_time ?? 0;
            if (chSpeed > 0 && chTime > 0 && curLat != null && curLon != null) {
                const chDistM = chSpeed * chTime;
                singlePassEnergyWh += estimatedTransitEnergyWh(
                    chDistM,
                    chSpeed,
                    calibration.transitPowerCurve,
                );
                singlePassExtraTimeS += chTime;
            }
        } else if (taskType === TaskType.SURFACE_DRIFT) {
            driftTotalS += task.getDriftParameters()?.drift_time ?? 0;
        } else if (taskType === TaskType.STATION_KEEP) {
            stationKeepTotalS += task.getStationKeepParameters()?.station_keep_time ?? 0;
        }
    }

    const waypointLocs = waypoints
        .map((wp) => wp.getLocation())
        .filter((loc): loc is { lat: number; lon: number } => loc?.lat != null && loc?.lon != null);
    const { turnDensityDegPerKm } = waypointGeometry(waypointLocs);

    // Return leg from last position back to first waypoint, paid (repeats-1) times
    let returnEnergyWh = 0;
    let returnDistanceM = 0;
    const firstLoc = waypoints[0]?.getLocation();
    if (
        repeats > 1 &&
        firstLoc?.lat != null &&
        firstLoc?.lon != null &&
        curLat != null &&
        curLon != null
    ) {
        returnDistanceM = getDistance([curLon, curLat], [firstLoc.lon, firstLoc.lat], EARTH_R);
        returnEnergyWh = estimatedTransitEnergyWh(
            returnDistanceM,
            transitSpeed,
            calibration.transitPowerCurve,
        );
    }
    const transitEnergyWh =
        toFirstEnergyWh + singlePassEnergyWh * repeats + returnEnergyWh * (repeats - 1);
    diveCount *= repeats;
    diveDepthM *= repeats;
    diveHoldS *= repeats;
    driftTotalS *= repeats;
    stationKeepTotalS *= repeats;

    const meanDiveDepthM = diveCount > 0 ? diveDepthM / diveCount : 0;
    const singlePassTimeS = singlePassDistanceM / transitSpeed + singlePassExtraTimeS;
    const toFirstTimeS = toFirstDistanceM / transitSpeed;
    const returnTimeS = returnDistanceM / transitSpeed;
    const transitTimeS = toFirstTimeS + singlePassTimeS * repeats + returnTimeS * (repeats - 1);

    // Combined motor-off + low-motor-load energy: each non-transit task gets
    // its own measured wattage from the calibrated constants.
    const hotelEnergyWh =
        (calibration.diveHoldW * diveHoldS +
            calibration.surfaceDriftW * driftTotalS +
            calibration.stationKeepW * stationKeepTotalS) /
        3600;

    // Full-dive-cycle energy (descent through GPS reacquire), excluding the
    // HOLD time which is already counted in hotelEnergyWh.
    const diveEnergyWh =
        diveCount * (calibration.diveEnergyBaseWh + calibration.diveEnergyPerMWh * meanDiveDepthM);

    try {
        const response = await fetch(BATTERY_PREDICTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                bot_type: bot.getBotType(),
                transit_energy_wh: transitEnergyWh,
                transit_time_s: transitTimeS,
                turn_density_deg_per_km: turnDensityDegPerKm,
                hotel_energy_wh: hotelEnergyWh,
                dive_energy_wh: diveEnergyWh,
                starting_battery_pct: bot.getBatteryPercent(),
            }),
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

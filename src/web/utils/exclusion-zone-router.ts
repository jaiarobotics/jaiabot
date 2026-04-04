/**
 * Client-side route planning around exclusion zones.
 *
 * Mirrors the logic in src/bin/mission_manager/exclusion_zone_router.h but
 * runs in the browser so the UI can preview and confirm bypass waypoints
 * before sending the mission plan to the bot.
 */

import { GeographicCoordinate, Goal, MissionPlan } from "../types/protobuf-types";
import { ExclusionZone } from "../types/protobuf-types";
import { exclusionZoneSet } from "../data/exclusion_zones/exclusion-zone-set";
import { UNASSIGNED_ID } from "./constants";

// Metres per degree of latitude (approximate, good to 0.1% at all latitudes)
const METERS_PER_DEG = 111320;

interface XYPt {
    x: number;
    y: number;
}

// Simple equirectangular projection — accurate to <0.1% for distances up to ~50 km.
function toXY(origin: GeographicCoordinate, coord: GeographicCoordinate): XYPt {
    const lat0 = origin.lat ?? 0;
    const lon0 = origin.lon ?? 0;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);
    return {
        x: ((coord.lon ?? 0) - lon0) * cosLat * METERS_PER_DEG,
        y: ((coord.lat ?? 0) - lat0) * METERS_PER_DEG,
    };
}

function toLatLon(origin: GeographicCoordinate, pt: XYPt): GeographicCoordinate {
    const lat0 = origin.lat ?? 0;
    const lon0 = origin.lon ?? 0;
    const cosLat = Math.cos((lat0 * Math.PI) / 180);
    return {
        lat: lat0 + pt.y / METERS_PER_DEG,
        lon: lon0 + pt.x / (cosLat * METERS_PER_DEG),
    };
}

function cross(O: XYPt, A: XYPt, B: XYPt): number {
    return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

function convexHull(pts: XYPt[]): XYPt[] {
    if (pts.length < 3) return [];
    const sorted = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
    const hull: XYPt[] = [];
    for (const p of sorted) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0)
            hull.pop();
        hull.push(p);
    }
    const lower = hull.length;
    for (let i = sorted.length - 2; i >= 0; i--) {
        while (
            hull.length > lower &&
            cross(hull[hull.length - 2], hull[hull.length - 1], sorted[i]) <= 0
        )
            hull.pop();
        hull.push(sorted[i]);
    }
    hull.pop();
    return hull.length >= 3 ? hull : [];
}

function segmentsIntersect(A: XYPt, B: XYPt, C: XYPt, D: XYPt): boolean {
    const d1 = cross(C, D, A);
    const d2 = cross(C, D, B);
    const d3 = cross(A, B, C);
    const d4 = cross(A, B, D);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function pointInPolygon(P: XYPt, poly: XYPt[]): boolean {
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (cross(poly[i], poly[(i + 1) % n], P) < 0) return false;
    }
    return true;
}

function segmentIntersectsPolygon(A: XYPt, B: XYPt, poly: XYPt[]): boolean {
    if (pointInPolygon(A, poly) || pointInPolygon(B, poly)) return true;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
        if (segmentsIntersect(A, B, poly[i], poly[(i + 1) % n])) return true;
    }
    return false;
}

function expandPolygon(poly: XYPt[], margin: number): XYPt[] {
    const cx = poly.reduce((s, v) => s + v.x, 0) / poly.length;
    const cy = poly.reduce((s, v) => s + v.y, 0) / poly.length;
    return poly.map((v) => {
        const dx = v.x - cx;
        const dy = v.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-6) return v;
        return { x: cx + (dx * (dist + margin)) / dist, y: cy + (dy * (dist + margin)) / dist };
    });
}

function distSq(A: XYPt, B: XYPt): number {
    return (A.x - B.x) ** 2 + (A.y - B.y) ** 2;
}

export interface RouteResult {
    /** Modified plan with bypass waypoints inserted */
    plan: MissionPlan;
    /** Number of bypass waypoints inserted */
    bypassCount: number;
}

/**
 * Routes the mission plan around any exclusion zones assigned to the given bot.
 * Returns the original plan unchanged if no intersections are found.
 */
export function routeAroundExclusionZones(
    plan: MissionPlan,
    botID: number,
    safetyMargin = 15,
): RouteResult {
    const goals = plan.goal ?? [];
    if (goals.length < 2) return { plan, bypassCount: 0 };

    // Collect zones assigned to this bot or to all bots.
    const zones = exclusionZoneSet.getZones();
    const relevantZones: ExclusionZone[] = [];
    for (const [zoneID, zone] of zones) {
        const assigned = exclusionZoneSet.getAssignment(zoneID);
        if (assigned.includes(UNASSIGNED_ID) || assigned.includes(botID)) {
            relevantZones.push(zone);
        }
    }
    if (relevantZones.length === 0) return { plan, bypassCount: 0 };

    // Use the first goal as the projection origin.
    const origin = goals[0].location!;

    // Pre-compute convex hulls and expanded polygons.
    interface ZoneGeom {
        hull: XYPt[];
        expanded: XYPt[];
    }
    const zoneGeoms: ZoneGeom[] = [];
    for (const zone of relevantZones) {
        if (!zone.vertices || zone.vertices.length < 3) continue;
        const pts = zone.vertices.map((v) => toXY(origin, v));
        const hull = convexHull(pts);
        if (hull.length < 3) continue;
        zoneGeoms.push({ hull, expanded: expandPolygon(hull, safetyMargin) });
    }
    if (zoneGeoms.length === 0) return { plan, bypassCount: 0 };

    let currentGoals = [...goals];
    let totalInserted = 0;
    const MAX_ITERATIONS = 10;

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
        let changed = false;
        const newGoals: Goal[] = [];

        for (let i = 0; i < currentGoals.length - 1; i++) {
            newGoals.push(currentGoals[i]);
            const A = toXY(origin, currentGoals[i].location!);
            const B = toXY(origin, currentGoals[i + 1].location!);

            let bestBypass: XYPt | null = null;
            let bestCost = Infinity;

            for (const zg of zoneGeoms) {
                if (!segmentIntersectsPolygon(A, B, zg.expanded)) continue;

                for (const v of zg.expanded) {
                    // v must not be inside any original zone
                    if (zoneGeoms.some((z) => pointInPolygon(v, z.hull))) continue;
                    // A→v and v→B must not cross the original hull
                    if (segmentIntersectsPolygon(A, v, zg.hull)) continue;
                    if (segmentIntersectsPolygon(v, B, zg.hull)) continue;

                    const cost = Math.sqrt(distSq(A, v)) + Math.sqrt(distSq(v, B));
                    if (cost < bestCost) {
                        bestCost = cost;
                        bestBypass = v;
                    }
                }
            }

            if (bestBypass) {
                const latlon = toLatLon(origin, bestBypass);
                newGoals.push({ location: latlon, name: "route_bypass" });
                changed = true;
                totalInserted++;
            }
        }
        newGoals.push(currentGoals[currentGoals.length - 1]);
        currentGoals = newGoals;
        if (!changed || currentGoals.length > 50) break;
    }

    if (totalInserted === 0) return { plan, bypassCount: 0 };

    return {
        plan: { ...plan, goal: currentGoals },
        bypassCount: totalInserted,
    };
}

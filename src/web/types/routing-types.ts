import { RerouteResult, RerouteStep, RestoreResult } from "../data/mission_set/mission";

/** A step for every waypoint, or why the waypoints cannot be routed. */
export type RoutingResult =
    | { kind: "routed"; steps: RerouteStep[] }
    | { kind: "allWaypointsBlocked" }
    /** No way around the zones on the leg between these two original waypoint numbers. */
    | { kind: "noRoute"; leg: [number, number] };

/** What a reroute or restore did to one mission, for the report. */
export type RerouteOutcome = { missionID: number } & (
    | RerouteResult
    | { kind: "allWaypointsBlocked" }
    /**
     * No way around the zones on the leg between these waypoint numbers, as the mission shows
     * them; no leg when either end is suppressed.
     */
    | { kind: "noRoute"; leg?: [number, number] }
    | ({ kind: "restored" } & RestoreResult)
);

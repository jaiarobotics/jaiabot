import { RerouteResult, RerouteStep, RestoreResult } from "../data/mission_set/mission";

/** A step for every waypoint, or why the waypoints cannot be routed. */
export type RoutingResult =
    | { kind: "routed"; steps: RerouteStep[] }
    | { kind: "allWaypointsBlocked" }
    /** No way around the zones on the leg between these two waypoints, numbered from 1. */
    | { kind: "noRoute"; leg: [number, number] };

/** What a reroute or restore did to one mission, for the report. */
export type RerouteOutcome = { missionID: number } & (
    | RerouteResult
    | Exclude<RoutingResult, { kind: "routed" }>
    | ({ kind: "restored" } & RestoreResult)
);

import { ExclusionZoneSet } from "./exclusion_zones/exclusion-zone-set";
import { PendingReroute, PendingWaypointRemoval } from "./pending-route-data";

export class ObstacleAvoidanceData {
    private exclusionZoneSet: ExclusionZoneSet;
    private pendingReroute: PendingReroute | null;
    private pendingWaypointRemoval: PendingWaypointRemoval | null;
    private placementError: string;

    constructor() {
        this.exclusionZoneSet = new ExclusionZoneSet();
        this.pendingReroute = null;
        this.pendingWaypointRemoval = null;
        this.placementError = "";
    }

    getExclusionZoneSet(): ExclusionZoneSet {
        return this.exclusionZoneSet;
    }
    setExclusionZoneSet(value: ExclusionZoneSet) {
        this.exclusionZoneSet = value;
    }

    getPendingReroute(): PendingReroute | null {
        return this.pendingReroute;
    }
    setPendingReroute(value: PendingReroute | null) {
        this.pendingReroute = value;
    }

    getPendingWaypointRemoval(): PendingWaypointRemoval | null {
        return this.pendingWaypointRemoval;
    }
    setPendingWaypointRemoval(value: PendingWaypointRemoval | null) {
        this.pendingWaypointRemoval = value;
    }

    getPlacementError(): string {
        return this.placementError;
    }
    setPlacementError(value: string) {
        this.placementError = value;
    }
}

export const obstacleAvoidanceData = new ObstacleAvoidanceData();

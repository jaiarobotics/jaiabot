import { ExclusionZoneSet } from "./exclusion_zones/exclusion-zone-set";
import { PendingObstacleAvoidanceChange } from "./pending-route-data";

export class ObstacleAvoidanceData {
    private exclusionZoneSet: ExclusionZoneSet;
    private pendingChange: PendingObstacleAvoidanceChange | null;

    constructor() {
        this.exclusionZoneSet = new ExclusionZoneSet();
        this.pendingChange = null;
    }

    getExclusionZoneSet(): ExclusionZoneSet {
        return this.exclusionZoneSet;
    }
    setExclusionZoneSet(value: ExclusionZoneSet) {
        this.exclusionZoneSet = value;
    }

    getPendingChange(): PendingObstacleAvoidanceChange | null {
        return this.pendingChange;
    }
    setPendingChange(value: PendingObstacleAvoidanceChange | null) {
        this.pendingChange = value;
    }
}

export const obstacleAvoidanceData = new ObstacleAvoidanceData();

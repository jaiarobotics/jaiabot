import { ExclusionZoneSet } from "./exclusion_zones/exclusion-zone-set";
import { PendingChange } from "./pending-route-data";

export class ObstacleAvoidanceData {
    private exclusionZoneSet: ExclusionZoneSet;
    private pendingChange: PendingChange | null;

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

    getPendingChange(): PendingChange | null {
        return this.pendingChange;
    }
    setPendingChange(value: PendingChange | null) {
        this.pendingChange = value;
    }
}

export const obstacleAvoidanceData = new ObstacleAvoidanceData();

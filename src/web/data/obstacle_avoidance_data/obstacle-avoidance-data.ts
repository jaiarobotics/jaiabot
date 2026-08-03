import { ExclusionZoneSet } from "./exclusion_zones/exclusion-zone-set";
import { PendingObstacleAvoidanceDialog } from "./pending-route-data";

export class ObstacleAvoidanceData {
    private exclusionZoneSet: ExclusionZoneSet;
    private pendingDialog: PendingObstacleAvoidanceDialog | null;

    constructor() {
        this.exclusionZoneSet = new ExclusionZoneSet();
        this.pendingDialog = null;
    }

    getExclusionZoneSet(): ExclusionZoneSet {
        return this.exclusionZoneSet;
    }
    setExclusionZoneSet(value: ExclusionZoneSet) {
        this.exclusionZoneSet = value;
    }

    getPendingDialog(): PendingObstacleAvoidanceDialog | null {
        return this.pendingDialog;
    }
    setPendingDialog(value: PendingObstacleAvoidanceDialog | null) {
        this.pendingDialog = value;
    }
}

export const obstacleAvoidanceData = new ObstacleAvoidanceData();

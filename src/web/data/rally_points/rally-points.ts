import cloneDeep from "lodash.clonedeep";
import RallyPoint from "./rally-point";
import { UNASSIGNED_ID } from "../../utils/constants";

export interface RallyPointsSnapshot {
    rallyPoints: Map<number, RallyPoint>;
    nextRallyPointID: number;
    selectedRallyPointID: number;
}

export class RallyPoints {
    private rallyPoints: Map<number, RallyPoint>;
    private nextRallyPointID: number;
    private selectedRallyPointID: number;

    constructor() {
        this.rallyPoints = new Map<number, RallyPoint>();
        this.nextRallyPointID = 1;
        this.selectedRallyPointID = UNASSIGNED_ID;
    }

    getRallyPoints() {
        return this.rallyPoints;
    }

    setRallyPoints(rallyPoints: Map<number, RallyPoint>) {
        this.rallyPoints = rallyPoints;
    }

    getNextRallyPointID() {
        return this.nextRallyPointID;
    }

    setNextRallyPointID(nextRallyPointID: number) {
        this.nextRallyPointID = nextRallyPointID;
    }

    getSelectedRallyPointID() {
        return this.selectedRallyPointID;
    }

    setSelectedRallyPointID(selectedRallyPointID: number) {
        this.selectedRallyPointID = selectedRallyPointID;
    }

    addRallyPoint(rallyPoint: RallyPoint) {
        const rallyPointID = this.nextRallyPointID;
        rallyPoint.setRallyPointID(rallyPointID);
        this.rallyPoints.set(rallyPointID, rallyPoint);
        this.nextRallyPointID++;
        // TODO Might want to set Selected RallyPoint
        return rallyPointID;
    }

    deleteRallyPoint(rallyPointID: number) {
        this.rallyPoints.delete(rallyPointID);
        if (rallyPointID === this.selectedRallyPointID) {
            this.selectedRallyPointID = UNASSIGNED_ID;
        }
    }

    captureSnapshot() {
        const currentRallyPoints: RallyPointsSnapshot = {
            rallyPoints: this.rallyPoints,
            nextRallyPointID: this.nextRallyPointID,
            selectedRallyPointID: this.selectedRallyPointID,
        };
        return cloneDeep(currentRallyPoints);
    }

    restoreFromSnapshot(snapshot: RallyPointsSnapshot) {
        this.rallyPoints = snapshot.rallyPoints;
        this.nextRallyPointID = snapshot.nextRallyPointID;
        this.selectedRallyPointID = snapshot.selectedRallyPointID;
    }
}

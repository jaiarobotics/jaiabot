import { Intercept, Track } from "../../types/protobuf-types";
import { UNASSIGNED_ID } from "../../utils/constants";

export class Sentinel {
    private tracks: Map<number, Track>;
    private intercepts: Map<number, Intercept>;
    private selectedID: number;

    constructor() {
        this.tracks = new Map();
        this.intercepts = new Map();
        this.selectedID = UNASSIGNED_ID;
    }

    getTracks() {
        return this.tracks;
    }

    setTracks(tracks: Map<number, Track>) {
        this.tracks = tracks;
    }

    getIntercepts() {
        return this.intercepts;
    }

    setIntercepts(intercepts: Map<number, Intercept>) {
        this.intercepts = intercepts;
    }

    getSelectedID() {
        return this.selectedID;
    }

    setSelectedID(selectedID: number) {
        this.selectedID = selectedID;
    }
}

export const sentinel = new Sentinel();

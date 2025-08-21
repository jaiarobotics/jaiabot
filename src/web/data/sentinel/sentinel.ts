import { Intercept, Track } from "../../types/protobuf-types";

export class Sentinel {
    private tracks: Map<number, Track>;
    private intercepts: Map<number, Intercept>;

    constructor() {
        this.tracks = new Map();
        this.intercepts = new Map();
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
}

export const sentinel = new Sentinel();

import { Intercept, Track } from "../../types/protobuf-types";

export class Sentinel {
    private tracks: Track[];
    private intercepts: Intercept[];

    constructor() {
        this.tracks = [];
        this.intercepts = [];
    }

    getTracks() {
        return this.tracks;
    }

    setTracks(tracks: Track[]) {
        this.tracks = tracks;
    }

    getIntercepts() {
        return this.intercepts;
    }

    setIntercepts(intercepts: Intercept[]) {
        this.intercepts = intercepts;
    }
}

export const sentinel = new Sentinel();

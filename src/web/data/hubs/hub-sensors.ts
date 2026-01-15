import GPS from "../sensors/gps";

export default class HubSensors {
    private gps: GPS;

    constructor() {
        this.initBaseSensors();
    }

    initBaseSensors() {
        this.gps = new GPS();
    }

    getGPS() {
        return this.gps;
    }
}

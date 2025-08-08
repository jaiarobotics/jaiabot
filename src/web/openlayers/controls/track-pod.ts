import { bots } from "../../data/bots/bots";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { map } from "../maps/map";
import { getMapCoordinate } from "../../shared/Utilities";

class TrackPod {
    private trackingTarget: string | null = null;
    private intervalId: number | null = null;

    /**
     * Starts the tracking functionality for "pod"
     */
    startTracking() {
        this.trackingTarget = "pod";

        if (!this.intervalId) {
            this.intervalId = window.setInterval(() => {
                this.doTracking();
            }, 500);
        }
    }

    /**
     * Stops the tracking functionality
     */
    stopTracking() {
        this.trackingTarget = null;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Gets the current tracking target
     */
    getTrackingTarget() {
        return this.trackingTarget;
    }

    /**
     * Main tracking logic - centers the map on the pod centroid
     */
    private doTracking() {
        if (this.trackingTarget === "pod") {
            this.trackPodCentroid(bots.getBots());
        }
    }

    private trackPodCentroid(botsMap: Map<number, any>) {
        let latSum = 0;
        let lonSum = 0;
        let count = 0;

        for (const bot of botsMap.values()) {
            const location = bot.getLocation();
            if (location && !isNaN(location.lat) && !isNaN(location.lon)) {
                latSum += location.lat;
                lonSum += location.lon;
                count++;
            }
        }

        if (count > 0) {
            const centroidLat = latSum / count;
            const centroidLon = lonSum / count;
            this.centerOnBot({ lat: centroidLat, lon: centroidLon });
        }
    }

    private centerOnBot(location: GeographicCoordinate) {
        if (!location || typeof location.lat !== "number" || typeof location.lon !== "number") {
            return;
        }

        const mapCoordinate = getMapCoordinate(location, map);

        if (mapCoordinate) {
            map.getView().animate({
                center: mapCoordinate,
                duration: 200,
            });
        }
    }
}

// Export singleton instance
export const trackPod = new TrackPod();

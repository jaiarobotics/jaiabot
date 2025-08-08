import { bots } from "../../data/bots/bots";
import { PodStatus } from "../../shared/PortalStatus";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { map } from "../maps/map";
import { getMapCoordinate } from "../../shared/Utilities";

interface TrackingState {
    trackingTarget: string | number | null;
    lastBotCount: number;
}

class TrackPod {
    private state: TrackingState = {
        trackingTarget: null,
        lastBotCount: 0,
    };
    private intervalId: number | null = null;

    /**
     * Starts the tracking functionality
     * @param target The target to track (e.g., "pod" or a bot ID)
     */
    startTracking(target: string | number | null) {
        this.state.trackingTarget = target;

        if (target && !this.intervalId) {
            this.intervalId = window.setInterval(() => {
                this.doTracking();
            }, 500);
        }
    }

    /**
     * Stops the tracking functionality
     */
    stopTracking() {
        this.state.trackingTarget = null;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Gets the current tracking target
     */
    getTrackingTarget() {
        return this.state.trackingTarget;
    }

    /**
     * Main tracking logic - centers the map on the tracked target
     */
    private doTracking() {
        const { trackingTarget } = this.state;
        const botsMap = bots.getBots();
        const botCount = botsMap.size;

        if (trackingTarget === "pod") {
            this.trackPodCentroid(botsMap);
        } else if (
            typeof trackingTarget === "number" ||
            (typeof trackingTarget === "string" && !isNaN(Number(trackingTarget)))
        ) {
            this.trackBotById(Number(trackingTarget));
        }

        this.state.lastBotCount = botCount;
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

    private trackBotById(botId: number) {
        const bot = bots.getBot(botId);
        const location = bot?.getLocation();
        if (location && typeof location.lat === "number" && typeof location.lon === "number") {
            this.centerOnBot(location);
        }
    }

    /**
     * Centers the map on the given location
     * @param location Geographic coordinate to center on
     */
    private centerOnBot(location: GeographicCoordinate) {
        // Ensure location has both lat and lon defined
        if (!location || typeof location.lat !== "number" || typeof location.lon !== "number") {
            return;
        }

        const mapCoordinate = getMapCoordinate(location, map);

        if (mapCoordinate) {
            map.getView().animate({
                center: mapCoordinate,
                duration: 200, // Smooth animation
            });
        }
    }
}

// Export singleton instance
export const trackPod = new TrackPod();

import { fromLonLat } from "ol/proj";

import { bots } from "../../data/bots/bots";
import { map } from "../maps/map";

import { GeographicCoordinate } from "../../shared/proto/jaiabot/messages/geographic_coordinate";
import { DATA_MODEL_POLL_TIME } from "../../utils/constants";

class TrackPod {
    private intervalID: NodeJS.Timeout;

    constructor() {
        this.intervalID = null;
    }

    /**
     * Reports whether or not the pod is being tracked
     *
     * @returns {boolean} Whether or not the pod is being tracked
     */
    isTracking() {
        if (this.intervalID !== null) {
            return true;
        }
        return false;
    }

    /**
     * Starts an interval to update the map viewport periodically as the Bots move
     *
     * @returns {void}
     */
    startTracking() {
        this.intervalID = setInterval(() => {
            const botCount = bots.getBots().size;

            if (botCount === 0) return;

            let latSum = 0;
            let lonSum = 0;

            for (const bot of bots.getBots().values()) {
                const location = bot.getLocation();
                if (!location) return;
                latSum += location.lat;
                lonSum += location.lon;
            }

            this.panToPodCenter({
                lat: latSum / botCount,
                lon: lonSum / botCount,
            });
        }, DATA_MODEL_POLL_TIME);
    }

    /**
     * Stops the interval updating the map viewport
     *
     * @returns {void}
     */
    stopTracking() {
        clearInterval(this.intervalID);
        this.intervalID = null;
    }

    /**
     * Shifts the maps viewport to the provided location
     *
     * @param {GeographicLocation} location
     * @returns {void}
     */
    private panToPodCenter(location: GeographicCoordinate) {
        const mapCoordinate = fromLonLat(
            [location.lon, location.lat],
            map.getView().getProjection(),
        );

        if (mapCoordinate) {
            map.getView().animate({
                center: mapCoordinate,
                duration: 200,
            });
        }
    }
}

export const trackPod = new TrackPod();

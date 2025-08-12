import { fromLonLat } from "ol/proj";

import { bots } from "../../data/bots/bots";
import { map } from "../maps/map";

import { GeographicCoordinate } from "../../types/protobuf-types";
import { DATA_MODEL_POLL_TIME } from "../../utils/constants";

class TrackPod {
    private intervalID: NodeJS.Timeout;

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

    stopTracking() {
        clearInterval(this.intervalID);
    }

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

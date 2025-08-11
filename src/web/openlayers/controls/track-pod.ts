import { bots } from "../../data/bots/bots";
import { GeographicCoordinate } from "../../types/protobuf-types";
import { map } from "../maps/map";
import { getMapCoordinate } from "../../shared/Utilities";

class TrackPod {
    private trackingTarget: string | null = null;
    private intervalId: number | null = null;

    startTracking() {
        this.trackingTarget = "pod";

        if (!this.intervalId) {
            this.intervalId = window.setInterval(() => {
                if (this.trackingTarget === "pod") {
                    const botCount = bots.getBots().size;
                    if (botCount === 0) return; // nothing to track

                    let latSum = 0;
                    let lonSum = 0;

                    for (const bot of bots.getBots().values()) {
                        const location = bot.getLocation();
                        if (!location) return;
                        latSum += location.lat;
                        lonSum += location.lon;
                    }

                    this.PanToCenter({
                        lat: latSum / botCount,
                        lon: lonSum / botCount,
                    });
                }
            }, 500);
        }
    }

    stopTracking() {
        this.trackingTarget = null;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private PanToCenter(location: GeographicCoordinate) {
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

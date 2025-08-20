import { Feature } from "ol";
import { Style } from "ol/style";

export function generateTrackFeature() {
    const feature = new Feature();
    feature.setStyle(generateTrackStyle());
    return feature;
}

function generateTrackStyle() {
    return new Style();
}

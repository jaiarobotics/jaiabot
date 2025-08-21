import { Feature } from "ol";
import { Style } from "ol/style";
import { Track } from "../../../types/protobuf-types";

export function generateTrackFeature(track: Track) {
    const feature = new Feature();
    feature.setStyle(generateTrackStyle());
    return feature;
}

function generateTrackStyle() {
    return new Style();
}

import { Feature } from "ol";
import { Style } from "ol/style";
import { Track } from "../../../types/protobuf-types";
import { MapFeatureTypes } from "../../../types/openlayers-types";

export function generateTrackFeature(track: Track) {
    const feature = new Feature();
    feature.set("type", MapFeatureTypes.SENTINAL_TRACK);
    feature.set("id", track.id);
    feature.setStyle(generateTrackStyle());
    return feature;
}

function generateTrackStyle() {
    return new Style();
}

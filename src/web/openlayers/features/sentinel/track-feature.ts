import { Feature } from "ol";
import { Point } from "ol/geom";
import { Coordinate } from "ol/coordinate";
import { fromLonLat } from "ol/proj";
import { Icon, Style, Text, Fill } from "ol/style";

import { view } from "../../views/view";
import { Track } from "../../../types/protobuf-types";
import { MapFeatureTypes } from "../../../types/openlayers-types";

import trackIcon from "../../../style/icons/sentinel/track-icon.svg";

export function generateTrackFeature(track: Track) {
    if (!track.location) {
        return new Feature();
    }

    const coordinate: Coordinate = [track.location.lon, track.location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.set("type", MapFeatureTypes.SENTINAL_TRACK);
    feature.set("id", track.id);
    feature.setStyle(generateTrackStyle(track.id));
    return feature;
}

function generateTrackStyle(trackID: number) {
    return new Style({
        image: new Icon({
            src: trackIcon,
            scale: 0.45,
        }),
        text: new Text({
            text: trackID.toString(),
            font: "bold 11pt sans-serif",
            fill: new Fill({
                color: "white",
            }),
        }),
        zIndex: trackID,
    });
}

import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";

import { view } from "../views/view";
import { DivePacket, TaskPacket } from "../../types/protobuf-types";
import { Fill, Icon, Stroke, Style, Text } from "ol/style";

import diveMarker from "../../style/icons/dive-marker.svg";

export function generateDiveFeature(taskPacket: TaskPacket) {
    const divePacket = taskPacket.dive;
    const coordinate: Coordinate = [divePacket.start_location.lon, divePacket.start_location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.setStyle(generateDiveStyle(divePacket));
    feature.set("botID", taskPacket.bot_id);
    feature.set("startTime", taskPacket.start_time);
    return feature;
}

function generateDiveStyle(divePacket: DivePacket) {
    return new Style({
        image: new Icon({
            src: diveMarker,
            color: "white",
        }),
        text: new Text({
            text: getDiveText(divePacket),
            font: "14pt sans-serif",
            fill: new Fill({ color: "white" }),
            stroke: new Stroke({
                color: "black",
                width: 3,
            }),
            offsetY: 20,
        }),
    });
}

function getDiveText(divePacket: DivePacket) {
    if (divePacket.bottom_dive && divePacket.depth_achieved) {
        return `${divePacket.depth_achieved.toFixed(1)}m`;
    }
    return "";
}

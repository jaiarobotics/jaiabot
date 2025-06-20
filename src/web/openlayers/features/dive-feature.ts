import { Point } from "ol/geom";
import { Feature } from "ol";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";
import { Fill, Icon, Stroke, Style, Text } from "ol/style";

import { view } from "../views/view";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { DivePacket, TaskPacket } from "../../types/protobuf-types";

import diveMarker from "../../style/icons/dive-marker.svg";

enum MarkerColors {
    LIGHT = "white",
    DARK = "black",
}

let markerColor = MarkerColors.LIGHT;

export function generateDiveFeature(taskPacket: TaskPacket) {
    const divePacket = taskPacket.dive;
    const coordinate: Coordinate = [divePacket.start_location.lon, divePacket.start_location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    feature.setStyle(generateDiveStyle(taskPacket));
    feature.set("type", MapFeatureTypes.DIVE);
    feature.set("botID", taskPacket.bot_id);
    feature.set("startTime", taskPacket.start_time);
    return feature;
}

function generateDiveStyle(taskPacket: TaskPacket) {
    return new Style({
        image: new Icon({
            src: diveMarker,
            color: getColor(taskPacket),
        }),
        text: new Text({
            text: getDiveText(taskPacket.dive),
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

function getColor(taskPacket: TaskPacket) {
    const selectedTaskMarker = jaiaGlobal.getSelectedTaskMarker();

    if (
        selectedTaskMarker.botID === taskPacket.bot_id &&
        selectedTaskMarker.startTime === taskPacket.start_time
    ) {
        if (markerColor === MarkerColors.LIGHT) {
            markerColor = MarkerColors.DARK;
        } else {
            markerColor = MarkerColors.LIGHT;
        }
        return markerColor;
    }

    return MarkerColors.LIGHT;
}

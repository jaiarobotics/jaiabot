import { Feature } from "ol";
import { Coordinate } from "ol/coordinate";
import { fromLonLat } from "ol/proj";
import { LineString, Point } from "ol/geom";
import { Fill, Icon, Style, Stroke, Text } from "ol/style";

import { view } from "../../views/view";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { TaskType } from "../../../types/protobuf-types";
import { OpenLayersColors } from "../../../style/openlayers/colors";
import { gridPlan } from "../../../data/survey_planner/grid-plan";

import waypointIcon from "../../../style/icons/waypoint.svg";
import waypointDiveIcon from "../../../style/icons/waypoint-dive.svg";
import waypointDriftIcon from "../../../style/icons/waypoint-drift.svg";
import { MapFeatureTypes } from "../../../types/openlayers-types";

export function generateSurveyLane(
    startLocation: GeographicCoordinate,
    endLocation: GeographicCoordinate,
) {
    if (!startLocation || !endLocation) {
        return new Feature();
    }

    const startCoordinate = fromLonLat(
        [startLocation.lon, startLocation.lat],
        view.getProjection(),
    );
    const endCoordinate = fromLonLat([endLocation.lon, endLocation.lat], view.getProjection());
    const feature = new Feature({
        geometry: new LineString([startCoordinate, endCoordinate]),
    });
    feature.setStyle(generateSurveyLaneStyle());
    return feature;
}

export function generateSurveyPoint(
    location: GeographicCoordinate,
    waypointNum: number,
    laneNum: number,
) {
    if (!location) {
        return new Feature();
    }

    const coordinate: Coordinate = [location.lon, location.lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });

    feature.set("type", MapFeatureTypes.WAYPOINT);
    feature.set("waypointNum", waypointNum);
    feature.set("missionID", laneNum);
    feature.setStyle(generateSurveyPointStyle(waypointNum, laneNum));
    return feature;
}

function generateSurveyLaneStyle() {
    const underlayStyle = new Style({
        stroke: new Stroke({
            width: 4,
            color: OpenLayersColors.OUTLINE,
        }),
        zIndex: 1,
    });

    const overlayStyle = new Style({
        stroke: new Stroke({
            width: 2,
            color: OpenLayersColors.EDIT,
        }),
        zIndex: 1,
    });

    return [underlayStyle, overlayStyle];
}

function generateSurveyPointStyle(waypointNum: number, laneNum: number) {
    const mission = gridPlan.getMissions().get(laneNum);

    let imageSrc = waypointIcon;
    if (mission && mission.getWaypoint(waypointNum)) {
        switch (mission.getWaypoint(waypointNum).getTask().getType()) {
            case TaskType.DIVE:
                imageSrc = waypointDiveIcon;
                break;
            case TaskType.SURFACE_DRIFT:
                imageSrc = waypointDriftIcon;
                break;
        }
    }

    return new Style({
        image: new Icon({
            src: imageSrc,
            anchor: [0.5, 1],
            color: OpenLayersColors.EDIT,
        }),
        stroke: new Stroke({
            color: OpenLayersColors.OUTLINE,
            width: 50,
        }),
        text: new Text({
            text: String(waypointNum),
            font: "12pt sans-serif",
            fill: new Fill({
                color: OpenLayersColors.TEXT,
            }),
            offsetY: -15,
        }),
        // Multiplying by lane number allows waypoints to stack when
        // lanes converge due to zoom level changes
        zIndex: waypointNum + 100 * laneNum,
    });
}

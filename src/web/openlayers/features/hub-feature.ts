// OpenLayers
import { Feature } from "ol";
import { Fill, Icon, Style, Text } from "ol/style";
import { Point } from "ol/geom";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";

// Jaia
import Hub from "../../data/hubs/hub";
import { hubs } from "../../data/hubs/hubs";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { view } from "../views/view";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { NodeTypes } from "../../types/jaia-system-types";

// Style
import { MapIconColors } from "../../utils/style";
const hubIcon = require("../../style/icons/hub.svg");

const TEXT_OFFSET_RADIUS = 11;

export function generateHubFeature(hubID: number) {
    const hub = hubs.getHub(hubID);

    if (!hub) {
        return new Feature();
    }

    if (!hub.getLocation()) {
        return new Feature();
    }

    const coordinate: Coordinate = [hub.getLocation().lon, hub.getLocation().lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.set("type", MapFeatureTypes.HUB);
    feature.set("id", hubID);
    feature.setStyle(generateHubStyle(hub));
    return feature;
}

function generateHubStyle(hub: Hub) {
    return new Style({
        image: new Icon({
            src: hubIcon,
            color: getHubIconColor(hub),
            anchor: [0.5, 0.5],
            rotateWithView: true,
        }),
        text: new Text({
            text: "HUB",
            font: "bold 11pt sans-serif",
            fill: new Fill({
                color: "black",
            }),
            offsetX: 0,
            offsetY: TEXT_OFFSET_RADIUS,
        }),
    });
}

function getHubIconColor(hub: Hub) {
    const selectedNode = jaiaGlobal.getSelectedNode();
    if (selectedNode.type === NodeTypes.HUB && selectedNode.id === hub.getHubID()) {
        return MapIconColors.SELECTED;
    } else {
        return MapIconColors.DEFAULT;
    }
}

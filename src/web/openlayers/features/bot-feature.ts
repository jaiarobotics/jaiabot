// OpenLayers
import { Feature } from "ol";
import { Fill, Icon, Style, Text } from "ol/style";
import { Point } from "ol/geom";
import { fromLonLat } from "ol/proj";
import { Coordinate } from "ol/coordinate";

// Jaia
import Bot from "../../data/bots/bot";
import { bots } from "../../data/bots/bots";
import { jaiaGlobal } from "../../data/jaia_global/jaia-global";
import { view } from "../views/view";
import { MapIconColors } from "../../utils/style";
import { MapFeatureTypes } from "../../types/openlayers-types";
import { NodeTypes } from "../../types/jaia-system-types";

// Util
import { angleToXY } from "../../utils/style";

// Style
const botIcon = require("../../style/icons/bot.svg");

const TEXT_OFFSET_RADIUS = 11;

export function generateBotFeature(botID: number) {
    const bot = bots.getBot(botID);

    if (!bot) {
        return new Feature();
    }

    if (!bot.getLocation()) {
        return new Feature();
    }

    const coordinate: Coordinate = [bot.getLocation().lon, bot.getLocation().lat];
    const feature = new Feature({
        geometry: new Point(fromLonLat(coordinate, view.getProjection())),
    });
    feature.set("type", MapFeatureTypes.BOT);
    feature.set("id", botID);
    feature.setStyle(generateBotStyle(bot));
    return feature;
}

function generateBotStyle(bot: Bot) {
    const heading = bot.getBotSensors().getIMU().getHeading() ?? 0;

    return new Style({
        image: new Icon({
            src: botIcon,
            color: getBotIconColor(bot),
            anchor: [0.5, 0.5],
            rotation: heading,
            rotateWithView: true,
        }),
        text: new Text({
            text: bot.getBotID().toString(),
            font: "bold 11pt sans-serif",
            fill: new Fill({
                color: "black",
            }),
            rotateWithView: true,
            offsetX: -TEXT_OFFSET_RADIUS * angleToXY(heading).x,
            offsetY: -TEXT_OFFSET_RADIUS * angleToXY(heading).y,
        }),
    });
}

function getBotIconColor(bot: Bot) {
    const selectedNode = jaiaGlobal.getSelectedNode();
    if (selectedNode.type === NodeTypes.BOT && selectedNode.id === bot.getBotID()) {
        return MapIconColors.SELECTED;
    } else {
        return MapIconColors.DEFAULT;
    }
}

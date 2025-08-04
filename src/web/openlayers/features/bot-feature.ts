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
import { degreesToRadians } from "../../utils/conversions";
import { TEXT_OFFSET_RADIUS } from "../../utils/constants";

// Util
import { angleToXY } from "../../utils/style";

// Style
import botIcon from "../../style/icons/bot.svg";
import { MissionState } from "../../shared/JAIAProtobuf";

const satellite = require("../../style/icons/satellite.svg") as string;

const driftArrowColor = "darkorange";

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

function getGpsStyle(headingRadians: number): Style {
    return new Style({
        image: new Icon({
            src: satellite,
            color: driftArrowColor,
            anchor: [0.5, -1.25],
            scale: 1.25,
            rotation: headingRadians,
            rotateWithView: true,
        }),
        zIndex: 104, // One higher than the bot's zIndex to prevent to the bot from covering the icon
    });
}

function generateBotStyle(bot: Bot): Style[] {
    const heading = degreesToRadians(bot.getBotSensors().getIMU().getHeading()) ?? 0;

    const styles = [
        new Style({
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
            zIndex: getBotIconZIndex(bot),
        }),
    ];

    // Add GPS satellite if bot is in reacquire GPS state
    const missionStatus = bot.getMissionStatus();

    if (
        missionStatus.missionState ===
            MissionState.IN_MISSION__UNDERWAY__TASK__DIVE__REACQUIRE_GPS ||
        missionStatus.missionState === MissionState.IN_MISSION__PAUSE__REACQUIRE_GPS
    ) {
        styles.push(getGpsStyle(heading));
    }

    return styles;
}

function getBotIconColor(bot: Bot) {
    const selectedNode = jaiaGlobal.getSelectedNode();
    if (selectedNode.type === NodeTypes.BOT && selectedNode.id === bot.getBotID()) {
        return MapIconColors.SELECTED;
    } else {
        return MapIconColors.DEFAULT;
    }
}

function getBotIconZIndex(bot: Bot) {
    const selectedNode = jaiaGlobal.getSelectedNode();
    let botZIndex = 0;

    if (selectedNode.type === NodeTypes.BOT && selectedNode.id === bot.getBotID()) {
        // Assume there are less than 1000 bots
        botZIndex = 1000;
    } else {
        botZIndex = bot.getBotID();
    }

    return botZIndex;
}

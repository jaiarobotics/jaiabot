import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import Collection from "ol/Collection";
import Feature from "ol/Feature";
import { Map } from "ol";
import { Point } from "ol/geom";

import { HubOrBot } from "./HubOrBot";
import { PortalBotStatus } from "./shared/PortalStatus";
import { createGPSMarker } from "./shared/Marker";
import { getMapCoordinate } from "./shared/Utilities";
import * as Styles from "./shared/Styles";

export class BotLayers {
    layers: { [key: number]: VectorLayer<VectorSource> } = {};
    map: Map;
    zIndex: number;

    constructor(map: Map) {
        this.map = map;
        this.zIndex = 3000;
    }

    getBotLayer(bot_id: number) {
        if (this.layers[bot_id] == null) {
            this.layers[bot_id] = new VectorLayer({
                properties: {
                    name: `Bot ${bot_id}`,
                },
                source: new VectorSource({
                    wrapX: false,
                    features: new Collection([], { unique: true }),
                }),
            });
            this.map.addLayer(this.layers[bot_id]);
        }

        return this.layers[bot_id];
    }

    deleteBotLayer(bot_id: number) {
        this.map.removeLayer(this.layers[bot_id]);
        delete this.layers[bot_id];
    }

    update(bots: { [key: string]: PortalBotStatus }, selectedHubOrBot: HubOrBot) {
        const botExtents: { [key: number]: number[] } = {};

        // This needs to be synchronized somehow?
        for (let botId in bots) {
            let bot = bots[botId];

            // ID
            const bot_id = bot.bot_id;

            const botLayer = this.getBotLayer(bot_id);
            const botSource = botLayer.getSource();

            // Geometry
            const botLatitude = bot.location?.lat;
            const botLongitude = bot.location?.lon;

            var botFeature: Feature<Point> = botSource.getFeatureById(bot_id) as Feature<Point>;
            if (botFeature == null) {
                botFeature = new Feature<Point>({
                    name: String(bot_id),
                });
                botFeature.setId(bot_id);
                botSource.addFeature(botFeature);
            }

            if (bot?.location !== undefined) {
                botFeature.setGeometry(new Point(getMapCoordinate(bot.location, this.map)));
            }

            botFeature.set("type", "bot");
            botFeature.set("bot", bot);
            botFeature.setStyle(Styles.botMarker);

            const isSelected =
                selectedHubOrBot != null &&
                selectedHubOrBot.type == "bot" &&
                selectedHubOrBot.id == bot_id;
            botFeature.set("selected", isSelected);
            botFeature.set("controlled", false);

            if (botFeature.get("selected")) {
                botLayer.setZIndex(this.zIndex + 3);
            } else if (botFeature.get("rcMode")) {
                botLayer.setZIndex(this.zIndex + 2);
            } else if (botFeature.get("tracked")) {
                botLayer.setZIndex(this.zIndex + 1);
            } else {
                botLayer.setZIndex(this.zIndex);
            }

            botLayer.changed();
        } // end foreach bot

        // Remove bot layers for bot_ids that have disappeared
        const defunctBotIds = Object.keys(this.layers).filter((bot_id) => {
            return !(String(bot_id) in bots);
        });

        defunctBotIds.forEach((botIdString) => {
            this.deleteBotLayer(Number(botIdString));
        });
    }
}

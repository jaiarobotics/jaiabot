import { Feature } from "ol";

import JaiaVectorLayer from "./jaia-vector-layer";
import { bots } from "../../../data/bots/bots";
import { LayerTitles } from "../../../types/openlayers-types";
import { generateBotFeature } from "../../features/bot-feature";

class BotLayer extends JaiaVectorLayer {
    constructor() {
        super(LayerTitles.BOT_LAYER);
    }

    override updateFeatures() {
        let source = this.getVectorLayer().getSource();
        source.clear();
        for (let [botID, bot] of bots.getBots()) {
            const botFeature = generateBotFeature(botID);
            source.addFeature(botFeature);
        }
    }
}

export const botLayer = new BotLayer();

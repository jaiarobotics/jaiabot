import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { Map } from "ol";
import { HubOrBot } from "./HubOrBot";
import { PortalBotStatus } from "./shared/PortalStatus";
export declare class BotLayers {
    layers: {
        [key: number]: VectorLayer<VectorSource>;
    };
    map: Map;
    zIndex: number;
    constructor(map: Map);
    getBotLayer(bot_id: number): VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    deleteBotLayer(bot_id: number): void;
    update(bots: {
        [key: string]: PortalBotStatus;
    }, selectedHubOrBot: HubOrBot): void;
}

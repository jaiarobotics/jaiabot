import { Map } from "ol";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { PortalHubStatus } from "./shared/PortalStatus";
import { HubOrBot } from "./HubOrBot";
export declare class HubLayers {
    layers: {
        [key: number]: VectorLayer<VectorSource>;
    };
    map: Map;
    zIndex: number;
    constructor(map: Map);
    getHubLayer(hub_id: number): VectorLayer<VectorSource<import("ol/geom/Geometry").default>>;
    deleteHubLayer(hub_id: number): void;
    update(hubs: {
        [key: string]: PortalHubStatus;
    }, selectedHubOrBot: HubOrBot): void;
}

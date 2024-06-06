import { Map } from "ol";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Collection } from "ol";
import LayerGroup from "ol/layer/Group";
import { PortalHubStatus } from "./shared/PortalStatus";
import { HubOrBot } from "./HubOrBot";
import { getMapCoordinate } from "./shared/Utilities";
import { Point } from "ol/geom";
import { Feature } from "ol";
import * as Styles from "./shared/Styles";
import { Layer } from "ol/layer";

export class HubLayers {
    layers: { [key: number]: VectorLayer<VectorSource> } = {};
    map: Map;
    zIndex: number;

    constructor(map: Map) {
        this.map = map;
        this.zIndex = 3000;
    }

    getHubLayer(hub_id: number) {
        const layer = this.layers[hub_id];
        if (layer) {
            return layer;
        } else {
            const newLayer = new VectorLayer({
                properties: {
                    name: hub_id,
                    hub_id: hub_id,
                },
                zIndex: this.zIndex,
                source: new VectorSource({
                    wrapX: false,
                    features: new Collection([], { unique: true }),
                }),
            });

            this.layers[hub_id] = newLayer;
            this.map.addLayer(newLayer);

            return newLayer;
        }
    }

    deleteHubLayer(hub_id: number) {
        this.map.removeLayer(this.layers[hub_id]);
        delete this.layers[hub_id];
    }

    /**
     * Used to update the hub icons on the OpenLayers map
     *
     * @param {{[key: string]: PortalHubStatus}} hubs - map of hubs to loop through and check for updates
     * @param {HubOrBot} selectedHubOrBot - an object to determine if a hub id is selected so we can update state accordingly
     * @returns {void}
     */
    update(hubs: { [key: string]: PortalHubStatus }, selectedHubOrBot: HubOrBot) {
        for (let hubId in hubs) {
            let hub = hubs[hubId];

            // ID
            const hub_id = hub.hub_id;

            const hubLayer = this.getHubLayer(hub_id);
            const hubSource = hubLayer.getSource();
            let hubFeature = hubSource.getFeatureById(hub_id) as Feature<Point>;
            if (hubFeature === null) {
                hubFeature = new Feature<Point>({
                    name: String(hub_id),
                });
                hubFeature.setId(hub_id);
                hubSource.addFeature(hubFeature);
            }

            if (hub?.location !== undefined) {
                hubFeature.setGeometry(new Point(getMapCoordinate(hub.location, this.map)));
            }

            hubFeature.setId(hub.hub_id);
            hubFeature.setStyle(Styles.hubMarker);
            hubFeature.setProperties({
                type: "hub",
                hub: hub,
            });

            const selected =
                selectedHubOrBot != null &&
                selectedHubOrBot.type == "hub" &&
                selectedHubOrBot.id == hub_id;
            hubFeature.set("selected", selected);

            hubLayer.changed();
        } // end foreach hub

        // Remove hub layers for hub_ids that have disappeared
        const defunctHubIds = Object.keys(this.layers).filter(
            (hub_id) => !(String(hub_id) in hubs),
        );

        defunctHubIds.forEach((hubIdString) => {
            this.deleteHubLayer(Number(hubIdString));
        });
    }
}

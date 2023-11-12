import { Map } from "ol"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import { Collection } from "ol"
import LayerGroup from "ol/layer/Group"
import { PortalHubStatus } from "./shared/PortalStatus"
import { HubOrBot } from "./HubOrBot"
import { getMapCoordinate } from "./shared/Utilities"
import { Point } from "ol/geom"
import { Feature } from "ol"
import * as Styles from "./shared/Styles"
import { Layer } from "ol/layer"


export class HubLayers {
    layers: {[key: number]: VectorLayer<VectorSource>} = {}
    map: Map
    zIndex: number

    constructor(map: Map) {
        this.map = map
        this.zIndex = 3000
    }

    getHubLayer(hub_id: number) {
        const layer = this.layers[hub_id]
        if (layer) {
            return layer
        }
        else {
            const newLayer = new VectorLayer({
                properties: {
                    name: hub_id,
                    hub_id: hub_id,
                },
                zIndex: this.zIndex,
                source: new VectorSource({
                    wrapX: false,
                    features: new Collection([], { unique: true })
                })
            })

            this.layers[hub_id] = newLayer
            this.map.addLayer(newLayer)

            return newLayer
        }
    }

    deleteHubLayer(hub_id: number) {
		this.map.removeLayer(this.layers[hub_id])
		delete this.layers[hub_id]
	}

    getHubFeature(hub: PortalHubStatus, map: Map, source: VectorSource) {
        const feature = source.getFeatureById(hub.hub_id)
        
        if (feature) {
            return feature
        }

        const newFeature = new Feature({
            name: hub.hub_id,
        })

        if (hub?.location !== undefined) {
            newFeature.setGeometry(new Point(getMapCoordinate(hub.location, this.map)))
        }

        newFeature.setId(hub.hub_id)
        newFeature.setStyle(Styles.hubMarker)
        newFeature.setProperties({
            'type': 'hub',
            'hub': hub
        })

        source.addFeature(newFeature)
    
        return newFeature
    }

	update(hubs: {[key: string]: PortalHubStatus}, selectedHubOrBot: HubOrBot) {
        for (let hubId in hubs) {
            let hub = hubs[hubId];
    
            // ID
            const hub_id = hub.hub_id

            const hubLayer = this.getHubLayer(hub_id)
            const hubSource = hubLayer.getSource()
            const hubFeature = this.getHubFeature(hub, this.map, hubSource)
    
            const selected = selectedHubOrBot != null && selectedHubOrBot.type == "hub" && selectedHubOrBot.id == hub_id
            hubFeature.set('selected', selected);
        } // end foreach hub
    }
}


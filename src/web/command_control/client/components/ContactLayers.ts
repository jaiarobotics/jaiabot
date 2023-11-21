import VectorSource from "ol/source/Vector"
import VectorLayer from "ol/layer/Vector"
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import { Map } from "ol"
import { Point } from "ol/geom"

import { HubOrBot } from "./HubOrBot"
import { PortalBotStatus } from "./shared/PortalStatus"
import { createGPSMarker } from "./shared/Marker"
import { getMapCoordinate } from "./shared/Utilities"
import * as Styles from "./shared/Styles"
import { ContactStatus } from "./shared/JAIAProtobuf"
import { layers } from './Layers'
import LayerGroup from 'ol/layer/Group';
import { layer } from "@fortawesome/fontawesome-svg-core"

export class ContactLayers {
    layers: {[key: number]: VectorLayer<VectorSource>} = {}
    map: Map
	zIndex: number

    constructor(map: Map) {
        this.map = map
		this.zIndex = 3000
    }

    getContactLayer(contact_id: number) {
		if (this.layers[contact_id] == null) {
			this.layers[contact_id] = new VectorLayer({
				properties: {
					name: `Contact ${contact_id}`,
				},
				zIndex: this.zIndex,
				source: new VectorSource({
					wrapX: false,
					features: new Collection([], { unique: true })
				})
			})
			this.map.addLayer(this.layers[contact_id])
		}

		return this.layers[contact_id]
	}

	deleteContactLayer(contact_id: number) {
		this.map.removeLayer(this.layers[contact_id])
		delete this.layers[contact_id]
	}

	update(contacts: {[key: string]: ContactStatus}) {
		for (let key in contacts) {
			let contact = contacts[key]

			// ID
			const contact_id = contact.contact

			const contactLayer = this.getContactLayer(contact_id)
			const contactSource = contactLayer.getSource()

			let contactFeature = contactSource.getFeatureById(contact_id) as Feature<Point>
			if (contactFeature === null) {
				contactFeature = new Feature<Point>({
					name: String(contact_id),
				})
				contactFeature.setId(contact_id)
				contactSource.addFeature(contactFeature)
			}
			
			if (contact.location !== undefined)
			{
				contactFeature.setGeometry(new Point(getMapCoordinate(contact.location, this.map)))
			}

			contactFeature.set('type', 'contact')
			contactFeature.set('contact', contact)
			contactFeature.setStyle(Styles.contactMarker)

			contactLayer.changed();

		} // end foreach contact

		// Remove contact layers for contact_ids that have disappeared
		const defunctContactIds = Object.keys(this.layers).filter((contact_id) => !(String(contact_id) in contacts))

		defunctContactIds.forEach((contactIdString) => {
			this.deleteContactLayer(Number(contactIdString))
		})
		
	}

}

import VectorSource from "ol/source/Vector"
import VectorLayer from "ol/layer/Vector"
import LayerGroup from 'ol/layer/Group'
import Collection from "ol/Collection"
import Feature from "ol/Feature"
import { Map } from "ol"
import { Point } from "ol/geom"

import * as Styles from "./shared/Styles"
import { ContactStatus } from "./shared/JAIAProtobuf"
import { getMapCoordinate } from "./shared/Utilities"

export class ContactLayers {
	layers: {[key: number]: VectorLayer<VectorSource>}
    map: Map
	zIndex: number
	contactGroup: LayerGroup

    constructor(map: Map) {
		this.layers = {}
        this.map = map
		this.zIndex = 3000
		this.contactGroup = new LayerGroup({
			properties: { 
				title: 'Contacts',
				fold: 'close',
			},
			layers: []
		})
		this.map.addLayer(this.contactGroup)
    }

	/**
	 * Returns the layer for a specific contact; if the layer for that contact does not exist,
	 * it is created
	 * 
	 * @param {number} contactId Used to locate specifc contact layer
	 * @returns {VectorLayer<VectorSource<Geometry>>} The contact layer
	 */
    getContactLayer(contactId: number) {
		if (this.layers[contactId] === undefined) {
			this.layers[contactId] = new VectorLayer({
				properties: {
					title: `Contact ${contactId}`,
					name: `Contact ${contactId}`,
				},
				zIndex: this.zIndex,
				source: new VectorSource({
					wrapX: false,
					features: new Collection([], { unique: true })
				})
			})
			this.contactGroup.getLayers().push(this.layers[contactId])
		}

		return this.layers[contactId]
	}

	/**
	 * Deletes a contact layer given a contact id
	 * 
	 * @param {number} contactId Identifies which contact layer to remove
	 * @returns {void}
	 */
	deleteContactLayer(contactId: number) {
		this.map.removeLayer(this.layers[contactId])
		delete this.layers[contactId]
	}

	/**
	 * Creates, deletes, and updates contact locations based on messages coming from the server
	 * 
	 * @param {{[key: string]: ContactStatus}} contacts Provides up-to-date data on contact
	 * @returns {void}
	 */
	update(contacts: {[key: string]: ContactStatus}) {
		for (let key in contacts) {
			let contact = contacts[key]
			const contactId = contact.contact
			const contactLayer = this.getContactLayer(contactId)
			const contactSource = contactLayer.getSource()
			let contactFeature = contactSource.getFeatureById(contactId) as Feature<Point>

			if (contactFeature === null) {
				contactFeature = new Feature<Point>({
					name: String(contactId),
				})
				contactFeature.setId(contactId)
				contactSource.addFeature(contactFeature)
			}
			
			if (contact.location !== undefined) {
				contactFeature.setGeometry(new Point(getMapCoordinate(contact.location, this.map)))
			}

			contactFeature.set('type', 'contact')
			contactFeature.set('contact', contact)
			contactFeature.setStyle(Styles.contactMarker)
		} // End for-each contact

		// Remove contact layers for contactIds that have disappeared
		const defunctContactIds = Object.keys(this.layers).filter(
			(contactId) => !(String(contactId) in contacts)
		)

		defunctContactIds.forEach((contactIdString) => {
			this.deleteContactLayer(Number(contactIdString))
		})
	}
}

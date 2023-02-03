import { Feature, Map } from "ol"
import { Point } from "ol/geom"
import { fromLonLat } from "ol/proj"
import * as Styles from "./Styles"

interface Properties {
    map: Map,
    hubId: number,
    lonLat: number[],
    heading: number,
    courseOverGround: number
}

export function createHubFeature(properties: Properties) {
    const projection = properties.map.getView().getProjection()

    const feature = new Feature({
        name: properties.hubId,
        geometry: new Point(fromLonLat(properties.lonLat, projection))
    })
    feature.setProperties(properties)
    feature.setStyle(Styles.hubMarker)

    return feature
}
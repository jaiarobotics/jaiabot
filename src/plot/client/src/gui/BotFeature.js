import { Feature } from "ol"
import { Point } from "ol/geom"
import { fromLonLat } from "ol/proj"
import * as Styles from "./Styles"


export function createBotFeature(properties) {
    var features = []
    const projection = properties.map.getView().getProjection()

    const feature = new Feature({
        name: properties.botId,
        geometry: new Point(fromLonLat(properties.lonLat, projection))
    })
    feature.setProperties(properties)
    feature.setStyle(Styles.botMarker)

    return feature
}


export function createBotCourseOverGroundFeature(properties) {
    var features = []
    const projection = properties.map.getView().getProjection()

    const feature = new Feature({
        name: properties.botId,
        geometry: new Point(fromLonLat(properties.lonLat, projection))
    })
    feature.setProperties(properties)
    feature.setStyle(Styles.courseOverGroundArrow)

    return feature
}

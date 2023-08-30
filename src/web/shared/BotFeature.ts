import { Feature, Map } from "ol"
import { Point } from "ol/geom"
import { fromLonLat } from "ol/proj"
import * as Styles from "./Styles"


interface Properties {
    map: Map,
    botId: number
    lonLat: number[]
    heading: number
    courseOverGround: number
}


export function createBotFeature(properties: Properties) {
    const projection = properties.map.getView().getProjection()

    const feature = new Feature({
        name: properties.botId,
        geometry: new Point(fromLonLat(properties.lonLat, projection))
    })
    
    feature.setProperties(properties)
    feature.setStyle(Styles.botMarker)

    return feature
}


export function createBotCourseOverGroundFeature(properties: Properties) {
    const projection = properties.map.getView().getProjection()

    const feature = new Feature({
        name: properties.botId,
        geometry: new Point(fromLonLat(properties.lonLat, projection))
    })

    feature.setProperties(properties)
    feature.setStyle(Styles.courseOverGroundArrow(properties.courseOverGround))

    return feature
}


export function createBotDesiredHeadingFeature(properties: Properties) {
    const projection = properties.map.getView().getProjection()

    const feature = new Feature({
        name: properties.botId,
        geometry: new Point(fromLonLat(properties.lonLat, projection))
    })

    feature.setProperties(properties)
    feature.setStyle(Styles.desiredHeadingArrow)

    return feature
}

export function createBotHeadingFeature(properties: Properties) {
    const projection = properties.map.getView().getProjection()

    const feature = new Feature({
        name: properties.botId,
        geometry: new Point(fromLonLat(properties.lonLat, projection))
    })

    feature.setProperties(properties)
    feature.setStyle(Styles.headingArrow(properties.heading))

    return feature
}

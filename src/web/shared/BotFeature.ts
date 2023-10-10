import { BotStatus } from "./JAIAProtobuf"
import { Point } from "ol/geom"
import { fromLonLat } from "ol/proj"
import { Feature, Map } from "ol"
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

export function botPopupHTML(bot: BotStatus) {
    return `
        <h3>Bot ${bot.bot_id}</h3>
        <table>
            <tbody>
                <tr>
                    <th><image src="headingIcon.svg" style="vertical-align: middle; text-align: center;" /></th>
                    <th>Heading</th>
                    <td>${bot.attitude?.heading?.toFixed(1) ?? "?"}</td>
                    <td>deg</td>
                </tr>
                <tr>
                    <th><image src="courseOverGroundIcon.svg" style="vertical-align: middle; text-align: center;" /></th>
                    <th>Course Over Ground</th>
                    <td>${bot.attitude?.course_over_ground?.toFixed(1) ?? "?"}</td>
                    <td>deg</td>
                </tr>
            </tbody>
        </table>
    `
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
        geometry: new Point(fromLonLat(properties.lonLat, projection)),
        style: Styles.desiredHeadingArrow,
    })

    feature.setProperties(properties)

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

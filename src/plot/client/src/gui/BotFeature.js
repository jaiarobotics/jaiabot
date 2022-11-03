import { Feature } from "ol"
import { Point } from "ol/geom"
import { fromLonLat } from "ol/proj"
import * as Styles from "./Styles"


export function createBotFeature(map, botId, lonLat) {
    var features = []
    const projection = map.getView().getProjection()

    const feature = new Feature({
        name: botId,
        geometry: new Point(fromLonLat(lonLat, projection))
    })
    feature.set('botId', botId)
    feature.setStyle(Styles.botMarker)

    return feature
}

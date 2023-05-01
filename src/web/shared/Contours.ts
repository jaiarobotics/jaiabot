import GeoJSON from 'ol/format/GeoJSON'
import {Style, Stroke} from 'ol/style'
import { ProjectionLike } from 'ol/proj';

const equirectangular = 'EPSG:4326'

export function geoJSONToDepthContourFeatures(projection: ProjectionLike, geojson: object) {
    // Manually transform features from lon/lat to the view's projection.
    var features = new GeoJSON().readFeatures(geojson)
    features.forEach((feature) => {
        // Transform to the map's projection
        feature.getGeometry().transform(equirectangular, projection)

        const properties = feature.getProperties()
        const color = properties.color

        feature.setStyle(new Style({
            stroke: new Stroke({
                color: color,
                width: 2.0
            })
        }))

    })

    return features
}

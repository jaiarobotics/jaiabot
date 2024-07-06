import GeoJSON from "ol/format/GeoJSON";
import { Style, Stroke } from "ol/style";
import { ProjectionLike } from "ol/proj";

const equirectangular = "EPSG:4326";


/**
 * Transforms a depth contour GeoJSON string, document, buffer, or element into an array of OpenLayers geometries.
 *
 * @export
 * @param {ProjectionLike} projection The target OpenLayers projection.
 * @param {any} geojson The input GeoJSON object containing the depth contours.
 * @returns {Feature<Geometry>[]} The OpenLayers features contained in `geojson`.
 */
export function geoJSONToDepthContourFeatures(projection: ProjectionLike, geojson: any) {
    // Manually transform features from lon/lat to the view's projection.
    var features = new GeoJSON().readFeatures(geojson);
    features.forEach((feature) => {
        // Transform to the map's projection
        feature.getGeometry().transform(equirectangular, projection);

        const properties = feature.getProperties();
        const color = properties.color;

        feature.setStyle(
            new Style({
                stroke: new Stroke({
                    color: color,
                    width: 2.0,
                }),
            }),
        );
    });

    return features;
}


/**
 * Transforms a GeoJSON string, document, buffer, or element into an array of OpenLayers geometries.
 *
 * @export
 * @param {ProjectionLike} projection The target OpenLayers projection.
 * @param {any} geojson The input GeoJSON object.
 * @returns {Feature<Geometry>[]} The OpenLayers features contained in `geojson`.
 */
export function geoJSONToFeatures(projection: ProjectionLike, geojson: any) {
    // Manually transform features from lon/lat to the view's projection.
    var features = new GeoJSON().readFeatures(geojson);
    features.forEach((feature) => {
        // Transform to the map's projection
        feature.getGeometry().transform(equirectangular, projection);
    });

    return features;
}

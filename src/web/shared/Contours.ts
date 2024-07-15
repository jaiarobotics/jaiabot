import GeoJSON from "ol/format/GeoJSON";
import { Style, Fill, Stroke } from "ol/style";
import { ProjectionLike } from "ol/proj";

const equirectangular = "EPSG:4326";

export function geoJSONToDepthContourFeatures(projection: ProjectionLike, geojson: object) {
    // Manually transform features from lon/lat to the view's projection.
    var features = new GeoJSON().readFeatures(geojson);
    features.forEach((feature) => {
        // Transform to the map's projection
        feature.getGeometry().transform(equirectangular, projection);

        const properties = feature.getProperties();
        const fill = properties.fill;

        var style = new Style();

        if (properties.fill) {
            style.setFill(new Fill({ color: properties.fill }));
        }

        if (properties.stroke) {
            style.setStroke(new Stroke({ color: properties.stroke }));
        }

        feature.setStyle(style);
    });

    return features;
}

export function geoJSONToFeatures(projection: ProjectionLike, geojson: object) {
    // Manually transform features from lon/lat to the view's projection.
    var features = new GeoJSON().readFeatures(geojson);
    features.forEach((feature) => {
        // Transform to the map's projection
        feature.getGeometry().transform(equirectangular, projection);
    });

    return features;
}

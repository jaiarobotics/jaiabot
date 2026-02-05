import { GeoJSON } from "ol/format";
import { view } from "../views/view";
import { EQUIRECTANGULAR } from "../../utils/constants";
import { Fill, Stroke, Style } from "ol/style";

export function generateContourFeatures(geoJSON: any) {
    const features = new GeoJSON().readFeatures(geoJSON);

    features.forEach((feature) => {
        feature.getGeometry()?.transform(EQUIRECTANGULAR, view.getProjection());
        const properties = feature.getProperties();
        const style = new Style();

        if (properties?.fill) {
            style.setFill(new Fill({ color: properties.fill }));
        }

        if (properties?.stroke) {
            style.setStroke(new Stroke({ color: properties.stroke }));
        }

        feature.setStyle(style);
    });

    return features;
}

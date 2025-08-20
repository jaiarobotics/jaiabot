import { Feature } from "ol";
import { Style } from "ol/style";

export function generateInterceptFeature() {
    const feature = new Feature();
    feature.setStyle(generateInterceptStyle());
    return feature;
}

function generateInterceptStyle() {
    return new Style();
}

import { Feature } from "ol";
import { Style } from "ol/style";
import { Intercept } from "../../../types/protobuf-types";

export function generateInterceptFeature(intercept: Intercept) {
    const feature = new Feature();
    feature.setStyle(generateInterceptStyle());
    return feature;
}

function generateInterceptStyle() {
    return new Style();
}

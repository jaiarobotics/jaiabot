import { Feature } from "ol";
import { Style } from "ol/style";
import { Intercept } from "../../../types/protobuf-types";
import { MapFeatureTypes } from "../../../types/openlayers-types";

export function generateInterceptFeature(intercept: Intercept) {
    const feature = new Feature();
    feature.set("type", MapFeatureTypes.SENTINAL_INTERCEPT);
    feature.set("id", intercept.trackID);
    feature.setStyle(generateInterceptStyle());
    return feature;
}

function generateInterceptStyle() {
    return new Style();
}

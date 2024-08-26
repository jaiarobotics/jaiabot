import { Feature } from "ol";
import { Point } from "ol/geom";
import VectorSource from "ol/source/Vector";
import { transform } from "ol/proj";
import { Circle, Fill, Icon, Stroke, Style } from "ol/style";
import { jaiaAPI, JaiaResponse } from "../../common/JaiaAPI";
import { FeatureCollection } from "@turf/turf";
import { GeoJSON } from "ol/format";
import { colorNameToHex } from "./shared/Color";

interface AnnotationsResult {
    version: number;
    annotations: FeatureCollection;
}

export class Annotations {
    source = new VectorSource();
    version: number = undefined;
    projection = "EPSG:3857"; // mercator

    styleFunction = (feature: Feature) => {
        const properties = feature.getProperties();

        const radii: { [key: string]: number } = {
            small: 3,
            medium: 5,
            large: 7,
        };

        const markerRadius = radii[properties["marker-size"]] ?? 5;
        let markerColor = properties["marker-color"] ?? "#f00";

        const fill = new Fill({
            color: markerColor,
        });
        const stroke = new Stroke({
            color: "white",
            width: 1.25,
        });
        return [
            new Style({
                image: new Circle({
                    fill: fill,
                    stroke: stroke,
                    radius: markerRadius,
                }),
                fill: fill,
                stroke: stroke,
            }),
        ];
    };

    constructor() {
        setInterval(this.pollAnnotations.bind(this), 1000);
    }

    pollAnnotations() {
        jaiaAPI
            .getAnnotations(this.version)
            .then((response) => {
                if (response.status == 304) {
                    return null;
                }

                if (response.status == 200) {
                    return response.json() as JaiaResponse<AnnotationsResult>;
                }

                throw Error(`${response.status} ${response.statusText} ${response.text()}`);
            })
            .then((response) => {
                if (response == null) {
                    return;
                }

                const features = new GeoJSON({
                    dataProjection: "EPSG:4326", // equirectangular
                    featureProjection: this.projection,
                }).readFeatures(response.result.annotations);

                features.forEach((feature) => {
                    feature.set("type", "annotation");
                });

                this.source.clear();
                this.source.addFeatures(features);
                this.version = response.result.version;
            })
            .catch((reason) => {
                console.error(`getAnnotations: ${reason}`);
            });
    }
}

export let annotations = new Annotations();

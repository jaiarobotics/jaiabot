import { Feature } from "ol";
import { Point } from "ol/geom";
import VectorSource from "ol/source/Vector";
import { transform } from "ol/proj";
import { Circle, Fill, Icon, Stroke, Style } from "ol/style";
import { jaiaAPI, JaiaResponse } from "../../common/JaiaAPI";
import { FeatureCollection } from "@turf/turf";
import { GeoJSON } from "ol/format";

interface AnnotationsResult {
    version: number;
    annotations: FeatureCollection;
}

export class Annotations {
    source = new VectorSource();
    version: number = undefined;
    projection = "EPSG:3857"; // mercator
    styleFunction = (feature: Feature) => {
        const fill = new Fill({
            color: "#ff000070",
        });
        const stroke = new Stroke({
            color: "#ff0000",
            width: 1.25,
        });
        return [
            new Style({
                image: new Circle({
                    fill: fill,
                    stroke: stroke,
                    radius: 5,
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

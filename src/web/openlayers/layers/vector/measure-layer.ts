// OpenLayers
import BaseEvent from "ol/events/Event";
import CircleStyle from "ol/style/Circle.js";
import Fill from "ol/style/Fill.js";
import Style from "ol/style/Style.js";
import Stroke from "ol/style/Stroke.js";
import { Draw } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import { getLength } from "ol/sphere";

// Jaia
import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";

class MeasureLayer extends JaiaVectorLayer {
    private length: number;

    constructor() {
        super(LayerTitles.MEASURE_LAYER, layersZIndexes.get(LayerTitles.MEASURE_LAYER));
        this.getVectorLayer().setStyle(this.getLayerStyle());
    }

    getLength() {
        return this.length;
    }

    createDrawInteraction() {
        const draw = new Draw({
            source: this.getVectorLayer().getSource(),
            type: "LineString",
            style: this.getDrawStyle(),
        });

        draw.on("drawstart", (event: DrawEvent) => {
            this.getVectorLayer().getSource().clear();
            event.feature.getGeometry().on("change", (event: BaseEvent) => {
                this.length = getLength(event.target);
            });
        });
        return draw;
    }

    getLayerStyle() {
        const solidLineStyle = new Style({
            fill: new Fill({
                color: "rgba(255, 255, 255, 0.2)",
            }),
            stroke: new Stroke({
                color: "#ffcc33",
                width: 2,
            }),
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({
                    color: "#ffcc33",
                }),
            }),
        });
        return solidLineStyle;
    }

    getDrawStyle() {
        const dottedLineStyle = new Style({
            fill: new Fill({
                color: "rgba(255, 255, 255, 0.2)",
            }),
            stroke: new Stroke({
                color: "rgba(0, 0, 0, 0.5)",
                lineDash: [10, 10],
                width: 2,
            }),
            image: new CircleStyle({
                radius: 5,
                stroke: new Stroke({
                    color: "rgba(0, 0, 0, 0.7)",
                }),
                fill: new Fill({
                    color: "rgba(255, 255, 255, 0.2)",
                }),
            }),
        });
        return dottedLineStyle;
    }
}

export const measureLayer = new MeasureLayer();

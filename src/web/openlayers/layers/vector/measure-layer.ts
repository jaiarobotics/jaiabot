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
import { OpenLayersColors } from "../../../style/openlayers/colors";
import { KILOMETER_FACTOR } from "../../../utils/constants";

class MeasureLayer extends JaiaVectorLayer {
    private length: number;
    private draw: Draw;

    constructor() {
        super(LayerTitles.MEASURE_LAYER, layersZIndexes.get(LayerTitles.MEASURE_LAYER));
        this.getVectorLayer().setStyle(this.getLayerStyle());
        this.length = 0;
        this.draw = null;
    }

    getLength() {
        return this.length;
    }

    getDraw() {
        return this.draw;
    }

    createDrawInteraction() {
        this.draw = new Draw({
            source: this.getVectorLayer().getSource(),
            type: "LineString",
            style: this.getDrawStyle(),
        });

        this.draw.on("drawstart", (event: DrawEvent) => {
            this.getVectorLayer().getSource().clear();
            this.length = 0;
            document.getElementById("measured-distance").innerHTML = this.formatDistance();

            event.feature.getGeometry().on("change", (event: BaseEvent) => {
                this.length = getLength(event.target);
                document.getElementById("measured-distance").innerHTML = this.formatDistance();
            });
        });

        return this.draw;
    }

    clearDrawInteraction() {
        this.getVectorLayer().getSource().clear();
        this.length = 0;
        this.draw = null;
    }

    formatDistance() {
        if (this.length > KILOMETER_FACTOR) {
            return (this.length / KILOMETER_FACTOR).toFixed(1) + " km";
        }
        return this.length.toFixed(0) + " m";
    }

    getLayerStyle() {
        const solidLineStyle = new Style({
            fill: new Fill({
                color: "rgba(255, 255, 255, 0.2)",
            }),
            stroke: new Stroke({
                color: OpenLayersColors.MEASURE_LINE,
                width: 2,
            }),
            image: new CircleStyle({
                radius: 7,
                fill: new Fill({
                    color: OpenLayersColors.MEASURE_LINE,
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

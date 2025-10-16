import BaseEvent from "ol/events/Event";
import VectorSource from "ol/source/Vector";
import { Draw } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
("");

import JaiaVectorLayer from "./jaia-vector-layer";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { LineString } from "ol/geom";
import { Feature } from "ol";
import { toLonLat } from "ol/proj";
import { generateSurveyLine } from "../../features/survey-line";
import { GeographicCoordinate } from "../../../types/protobuf-types";
import { Stroke, Style } from "ol/style";

class GridLayer extends JaiaVectorLayer {
    private draw: Draw;
    private drawSource: VectorSource;

    constructor() {
        super(LayerTitles.GRID_LAYER, layersZIndexes.get(LayerTitles.GRID_LAYER));
        this.drawSource = new VectorSource();
    }

    getDraw() {
        return this.draw;
    }

    createDrawInteraction() {
        this.draw = new Draw({
            source: this.drawSource,
            type: "LineString",
            freehand: true,
            style: new Style({
                stroke: new Stroke({
                    color: "rgba(0,0,0,0)",
                    width: 0,
                }),
            }),
        });

        this.draw.on("drawstart", (event: DrawEvent) => {
            const feature = event.feature as Feature<LineString>;
            const startLocation3857 = feature.getGeometry().getFirstCoordinate();
            const startLocation4326 = toLonLat([startLocation3857[0], startLocation3857[1]]);
            const startLocation: GeographicCoordinate = {
                lat: startLocation4326[1],
                lon: startLocation4326[0],
            };

            event.feature.getGeometry().on("change", (event: BaseEvent) => {
                const currentLocation3857 = feature.getGeometry().getLastCoordinate();
                const currentLocation4326 = toLonLat([
                    currentLocation3857[0],
                    currentLocation3857[1],
                ]);
                const currentLocation: GeographicCoordinate = {
                    lat: currentLocation4326[1],
                    lon: currentLocation4326[0],
                };
                const surveyLine = generateSurveyLine(startLocation, currentLocation);
                this.getVectorLayer().getSource().clear();
                this.getVectorLayer().getSource().addFeature(surveyLine);
            });
        });

        this.draw.on("drawend", (event: DrawEvent) => {
            this.drawSource.clear();
        });

        return this.draw;
    }
}

export const gridLayer = new GridLayer();

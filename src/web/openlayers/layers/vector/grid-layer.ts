import * as turf from "@turf/turf";
import { Units } from "@turf/helpers";
import { Feature as TurfFeature, LineString as TurfLineString } from "geojson";

import BaseEvent from "ol/events/Event";
import VectorSource from "ol/source/Vector";
import { Draw } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import { Feature } from "ol";
import { LineString } from "ol/geom";
import { toLonLat } from "ol/proj";
import { Stroke, Style } from "ol/style";

import JaiaVectorLayer from "./jaia-vector-layer";
import { gridPlan } from "../../../data/survey_planner/grid-plan";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { generateSurveyLane, generateSurveyWaypoint } from "../../features/survey/survey-lane";
import { generateSurveyEndpoint } from "../../features/survey/survey-endpoints";

const units: Units = "meters";
const options = { units: units };

class GridLayer extends JaiaVectorLayer {
    private draw: Draw;
    private drawSource: VectorSource;
    private centerLine: TurfFeature<TurfLineString>;

    constructor() {
        super(LayerTitles.GRID_LAYER, layersZIndexes.get(LayerTitles.GRID_LAYER));
        this.drawSource = new VectorSource();
    }

    override updateFeatures() {}

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
            event.feature.getGeometry().on("change", (event: BaseEvent) => {
                const currentLocation3857 = feature.getGeometry().getLastCoordinate();
                const currentLocation4326 = toLonLat([
                    currentLocation3857[0],
                    currentLocation3857[1],
                ]);
                this.centerLine = turf.lineString([startLocation4326, currentLocation4326]);
                this.createGrid();
            });
        });

        this.draw.on("drawend", (event: DrawEvent) => {
            this.drawSource.clear();
        });

        return this.draw;
    }

    createGrid() {
        if (!this.centerLine) {
            return;
        }

        this.getVectorLayer().getSource().clear();

        let distFromCenter = 0;
        if (gridPlan.getNumOfLanes() % 2 === 0) {
            distFromCenter = gridPlan.getLaneSpacing() / 2;
        }

        for (let i = 0; i < gridPlan.getNumOfLanes(); i++) {
            const offsetLine = turf.lineOffset(this.centerLine, distFromCenter, options);

            const coordinates = offsetLine.geometry.coordinates;
            const startLocation = { lat: coordinates[0][1], lon: coordinates[0][0] };
            const endLocation = { lat: coordinates[1][1], lon: coordinates[1][0] };

            const laneFeature = generateSurveyLane(startLocation, endLocation);
            this.getVectorLayer().getSource().addFeature(laneFeature);

            this.createGridPoints(offsetLine);

            // For grids with even number of lanes, increase distance every two lanes
            // from the start
            if (gridPlan.getNumOfLanes() % 2 === 0 && i % 2 === 1) {
                distFromCenter = Math.abs(distFromCenter) + gridPlan.getLaneSpacing();
            }

            // For grids with odd number of lanes, increase distance every two lanes
            // after creation of the middle lane
            if (gridPlan.getNumOfLanes() % 2 !== 0 && i % 2 === 0) {
                distFromCenter = Math.abs(distFromCenter) + gridPlan.getLaneSpacing();
            }

            distFromCenter *= -1;
        }

        this.createGridEndPoints();
    }

    createGridPoints(lane: TurfFeature<TurfLineString>) {
        const lineDist = turf.length(lane, options);
        console.log(gridPlan.getPointSpacing());
        for (let dist = 0; dist < lineDist; dist += gridPlan.getPointSpacing()) {
            const coordinates = turf.along(lane, dist, options).geometry.coordinates;
            const waypointFeature = generateSurveyWaypoint({
                lat: coordinates[1],
                lon: coordinates[0],
            });
            this.getVectorLayer().getSource().addFeature(waypointFeature);
        }
    }

    createGridEndPoints() {
        this.getVectorLayer()
            .getSource()
            .addFeature(generateSurveyEndpoint(gridPlan.getMissionStart(), true));
        this.getVectorLayer()
            .getSource()
            .addFeature(generateSurveyEndpoint(gridPlan.getMissionEnd(), false));
    }

    resetGrid() {
        this.getVectorLayer().getSource().clear();
        this.centerLine = undefined;
    }
}

export const gridLayer = new GridLayer();

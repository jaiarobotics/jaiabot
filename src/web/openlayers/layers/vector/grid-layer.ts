import * as turf from "@turf/turf";
import { Units } from "@turf/helpers";
import { Position, Feature as TurfFeature, LineString as TurfLineString } from "geojson";

import BaseEvent from "ol/events/Event";
import VectorSource from "ol/source/Vector";
import { Draw } from "ol/interaction";
import { DrawEvent } from "ol/interaction/Draw";
import { Feature } from "ol";
import { LineString } from "ol/geom";
import { toLonLat } from "ol/proj";
import { Stroke, Style } from "ol/style";

import JaiaVectorLayer from "./jaia-vector-layer";
import Mission from "../../../data/mission_set/mission";
import { gridPlan } from "../../../data/survey_planner/grid-plan";
import { MissionSet } from "../../../data/mission_set/mission-set";
import { LayerTitles } from "../../../types/openlayers-types";
import { layersZIndexes } from "../zindex";
import { generateSurveyLane, generateSurveyWaypoint } from "../../features/survey/survey-lane";
import { generateSurveyEndpoint } from "../../features/survey/survey-endpoints";
import { GeographicCoordinate } from "../../../types/protobuf-types";

const units: Units = "meters";
const options = { units: units };

class GridLayer extends JaiaVectorLayer {
    private draw: Draw;
    private drawSource: VectorSource;
    private layerSource: VectorSource;
    private centerLine: TurfFeature<TurfLineString>;

    constructor() {
        super(LayerTitles.GRID_LAYER, layersZIndexes.get(LayerTitles.GRID_LAYER));
        this.drawSource = new VectorSource();
        this.layerSource = this.getVectorLayer().getSource();
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

    createGrid(saveLanes?: boolean) {
        if (!this.centerLine) {
            return;
        }

        const lanes = [];

        this.layerSource.clear();

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
            this.layerSource.addFeature(laneFeature);

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

            if (saveLanes) {
                lanes.push(offsetLine);
            }
        }

        this.createGridEndPoints();
        return lanes;
    }

    createGridPoints(lane: TurfFeature<TurfLineString>) {
        const points: Position[] = [];
        const lineDist = turf.length(lane, options);
        for (let dist = 0; dist < lineDist; dist += gridPlan.getPointSpacing()) {
            const coordinates = turf.along(lane, dist, options).geometry.coordinates;
            const waypointFeature = generateSurveyWaypoint({
                lat: coordinates[1],
                lon: coordinates[0],
            });
            this.layerSource.addFeature(waypointFeature);
            points.push(coordinates);
        }
        return points;
    }

    createGridEndPoints() {
        this.layerSource.addFeature(generateSurveyEndpoint(gridPlan.getMissionStart(), true));
        this.layerSource.addFeature(generateSurveyEndpoint(gridPlan.getMissionEnd(), false));
    }

    finalizeGrid() {
        const lanes = this.createGrid(true);
        this.layerSource.clear();
        this.createGridEndPoints();

        const surveyMissionSet = new MissionSet();

        for (const lane of lanes) {
            const points = this.createGridPoints(lane);
            const startPoint = points[0];
            const endPoint = points[points.length - 1];
            const laneStart: GeographicCoordinate = { lat: startPoint[1], lon: startPoint[0] };
            const laneEnd: GeographicCoordinate = { lat: endPoint[1], lon: endPoint[0] };
            const startLine = generateSurveyLane(gridPlan.getMissionStart(), laneStart);
            const endLine = generateSurveyLane(gridPlan.getMissionEnd(), laneEnd);
            const surveyLane = generateSurveyLane(laneStart, laneEnd);
            this.layerSource.addFeature(surveyLane);
            this.layerSource.addFeature(startLine);
            this.layerSource.addFeature(endLine);
            const mission = new Mission();
            mission.addWaypoint(gridPlan.getMissionStart());
            for (const point of points) {
                mission.addWaypoint({ lat: point[1], lon: point[0] });
            }
            mission.addWaypoint(gridPlan.getMissionEnd());
            surveyMissionSet.addMission(mission);
        }
    }

    resetGrid() {
        this.getVectorLayer().getSource().clear();
        this.centerLine = undefined;
    }
}

export const gridLayer = new GridLayer();
